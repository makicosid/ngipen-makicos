
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "crypto";
import { isIP } from "net";
import { promisify } from "util";

export const runtime = "nodejs";

const scrypt = promisify(scryptCallback);

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const COOKIE_NAME = "ngipen_session";
const SESSION_DAYS = 30;

/* =========================================================
   RESPONSE
========================================================= */

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

/* =========================================================
   VALIDATION
========================================================= */

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function validUsername(value: string) {
  return (
    value.length >= 1 &&
    value.length <= 30 &&
    /^[a-zA-Z0-9._]+$/.test(value)
  );
}

function validNewPassword(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[a-zA-Z]/.test(value) &&
    /[0-9]/.test(value)
  );
}

function validLoginPassword(value: string) {
  return value.length >= 1 && value.length <= 128;
}

function isSafeAvatarUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      return false;
    }

    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".test")
    ) {
      return false;
    }

    const ipVersion = isIP(host);
    if (ipVersion === 4) {
      const octets = host.split(".").map(Number);
      const [a, b] = octets;
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127) ||
        a >= 224
      ) {
        return false;
      }
    } else if (ipVersion === 6) {
      const normalized = host.toLowerCase();
      if (
        normalized === "::" ||
        normalized === "::1" ||
        normalized.startsWith("fc") ||
        normalized.startsWith("fd") ||
        /^fe[89ab]/.test(normalized) ||
        normalized.startsWith("::ffff:")
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/* =========================================================
   PASSWORD SECURITY
========================================================= */

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt$")) {
    return false;
  }

  const parts = stored.split("$");

  if (parts.length !== 3) {
    return false;
  }

  const [, salt, savedKey] = parts;

  try {
    const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
    const savedBuffer = Buffer.from(savedKey, "hex");

    return (
      savedBuffer.length === derivedKey.length &&
      timingSafeEqual(savedBuffer, derivedKey)
    );
  } catch {
    return false;
  }
}

function verifyLegacyPassword(password: string, stored: string) {
  const passwordBuffer = Buffer.from(password, "utf8");
  const storedBuffer = Buffer.from(stored, "utf8");

  return (
    passwordBuffer.length === storedBuffer.length &&
    timingSafeEqual(passwordBuffer, storedBuffer)
  );
}

/* =========================================================
   TOKEN & IP HASH
========================================================= */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getClientIpHash(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  const clientIp = forwardedFor
    ?.split(",")[0]
    ?.trim();

  if (!clientIp) {
    return null;
  }

  return createHash("sha256")
    .update(clientIp)
    .digest("hex");
}

/* =========================================================
   SESSION MANAGEMENT
========================================================= */

async function createSession(
  userId: string,
  response: NextResponse
) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

  if (error) {
    console.error("Session creation error:", error);
    throw new Error("Gagal membuat sesi login.");
  }

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

async function getSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);

  const { data, error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/* =========================================================
   GET - CHECK AUTHENTICATION
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return json({ authenticated: false }, 401);
    }

    const { data: user, error } = await getSupabaseAdmin()
      .from("users")
      .select("id, username, display_name, bio, avatar_url, created_at")
      .eq("id", session.user_id)
      .maybeSingle();

    if (error || !user) {
      return json({ authenticated: false }, 401);
    }

    return json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("Auth session error:", error);

    return json(
      { error: "Gagal memeriksa sesi." },
      500
    );
  }
}

/* =========================================================
   POST - AUTHENTICATION ACTIONS
========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* -----------------------------------------------------
       CSRF PROTECTION
    ----------------------------------------------------- */

    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json(
        { error: "Permintaan tidak diizinkan." },
        403
      );
    }

    const body = await request.json();
    const action = body.action;

    /* -----------------------------------------------------
       LOGOUT
    ----------------------------------------------------- */

    if (action === "logout") {
      const token = request.cookies.get(COOKIE_NAME)?.value;
      let deleteFailed = false;

      if (token) {
        try {
          const { error } = await getSupabaseAdmin()
            .from("ngipen_sessions")
            .delete()
            .eq("token_hash", hashToken(token));
          deleteFailed = Boolean(error);
        } catch {
          deleteFailed = true;
        }
      }

      const response = deleteFailed
        ? json(
            { success: false, error: "Sesi server belum dapat dicabut. Silakan coba logout kembali." },
            500
          )
        : json({ success: true });

      response.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    }
    /* -----------------------------------------------------
       UPDATE USER PROFILE
    ----------------------------------------------------- */

    if (action === "update_profile") {
      const session = await getSession(request);

      if (!session) {
        return json(
          { error: "Sesi login tidak valid. Silakan login kembali." },
          401
        );
      }

      const displayName =
        typeof body.displayName === "string"
          ? body.displayName.trim()
          : "";

      const bio =
        typeof body.bio === "string"
          ? body.bio.trim()
          : "";

      const avatarUrl =
        typeof body.avatarUrl === "string"
          ? body.avatarUrl.trim()
          : "";

      if (!displayName || displayName.length > 50) {
        return json(
          { error: "Nama tampilan wajib diisi dan maksimal 50 karakter." },
          400
        );
      }

      if (bio.length > 300) {
        return json(
          { error: "Bio maksimal 300 karakter." },
          400
        );
      }

      if (avatarUrl.length > 2048) {
        return json(
          { error: "URL avatar terlalu panjang." },
          400
        );
      }

      const { data: currentProfile, error: currentProfileError } =
        await getSupabaseAdmin()
          .from("users")
          .select("avatar_url")
          .eq("id", session.user_id)
          .maybeSingle();

      if (currentProfileError || !currentProfile) {
        console.error("Profile avatar lookup failed.");
        return json({ error: "Gagal memeriksa data profil." }, 500);
      }

      const avatarIsUnchanged =
        avatarUrl === String(currentProfile.avatar_url || "");

      if (avatarUrl && !avatarIsUnchanged && !isSafeAvatarUrl(avatarUrl)) {
        return json(
          { error: "URL avatar harus menggunakan HTTPS dan host publik yang valid." },
          400
        );
      }

      const { data: updatedUser, error: updateError } =
        await getSupabaseAdmin()
          .from("users")
          .update({
            display_name: displayName,
            bio,
            avatar_url: avatarUrl,
          })
          .eq("id", session.user_id)
          .select(
            "id,username,display_name,bio,avatar_url,created_at"
          )
          .maybeSingle();

      if (updateError) {
        console.error("Update user profile error:", updateError);

        return json(
          { error: "Gagal menyimpan perubahan profil." },
          500
        );
      }

      if (!updatedUser) {
        return json(
          { error: "Data akun tidak ditemukan." },
          404
        );
      }

      return json({
        success: true,
        user: updatedUser,
      });
    }
    
    /* -----------------------------------------------------
       CHANGE PASSWORD
    ----------------------------------------------------- */

    if (action === "change_password") {
      const session = await getSession(request);

      if (!session) {
        return json(
          { error: "Sesi login tidak valid. Silakan login kembali." },
          401
        );
      }

      const oldPassword =
        typeof body.oldPassword === "string"
          ? body.oldPassword
          : "";

      const newPassword =
        typeof body.newPassword === "string"
          ? body.newPassword
          : "";

      if (!validLoginPassword(oldPassword)) {
        return json(
          { error: "Password lama tidak valid." },
          400
        );
      }

      if (!validNewPassword(newPassword)) {
        return json(
          {
            error:
              "Password baru minimal 8 karakter, maksimal 128 karakter, dan harus berisi huruf serta angka.",
          },
          400
        );
      }

      const { data: user, error: userError } =
        await getSupabaseAdmin()
          .from("users")
          .select("id, password_hash")
          .eq("id", session.user_id)
          .maybeSingle();

      if (userError || !user) {
        console.error("Change password user lookup error:", userError);

        return json(
          { error: "Data akun tidak ditemukan." },
          404
        );
      }

      const storedPassword = String(user.password_hash || "");

      const passwordMatches = storedPassword.startsWith("scrypt$")
        ? await verifyPassword(oldPassword, storedPassword)
        : verifyLegacyPassword(oldPassword, storedPassword);

      if (!passwordMatches) {
        return json(
          { error: "Password lama salah." },
          401
        );
      }

      const newHash = await hashPassword(newPassword);

      const { error: updateError } =
        await getSupabaseAdmin()
          .from("users")
          .update({ password_hash: newHash })
          .eq("id", session.user_id);

      if (updateError) {
        console.error("Change password error:", updateError);

        return json(
          { error: "Gagal mengganti password." },
          500
        );
      }

      const currentToken = request.cookies.get(COOKIE_NAME)?.value;
      if (!currentToken) {
        return json({
          success: true,
          warning: "Password berubah, tetapi sesi lain belum dapat dicabut karena sesi saat ini tidak ditemukan.",
        });
      }

      const { error: revokeError } = await getSupabaseAdmin()
        .from("ngipen_sessions")
        .delete()
        .eq("user_id", session.user_id)
        .neq("token_hash", hashToken(currentToken));

      if (revokeError) {
        console.error("Other session revocation failed.");
        return json({
          success: true,
          warning: "Password berubah, tetapi sesi lain belum dapat dicabut. Silakan logout dari perangkat lain.",
        });
      }

      return json({ success: true });
    }

    /* -----------------------------------------------------
       USERNAME & PASSWORD
    ----------------------------------------------------- */

    const username =
      typeof body.username === "string"
        ? normalizeUsername(body.username)
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!validUsername(username)) {
      return json(
        { error: "Username tidak valid." },
        400
      );
    }

    /* -----------------------------------------------------
       REGISTER
    ----------------------------------------------------- */

    if (action === "register") {
      if (!validNewPassword(password)) {
        return json(
          {
            error:
              "Password minimal 8 karakter, maksimal 128 karakter, dan harus berisi huruf serta angka.",
          },
          400
        );
      }

      const { data: existing, error: checkError } =
        await getSupabaseAdmin()
          .from("users")
          .select("id")
          .eq("normalized_username", username)
          .maybeSingle();

      if (checkError) {
        console.error("Username check error:", checkError);

        return json(
          { error: "Gagal memeriksa username." },
          500
        );
      }

      if (existing) {
        return json(
          { error: "Username sudah digunakan." },
          409
        );
      }

      const passwordHash = await hashPassword(password);

      const displayName =
        typeof body.displayName === "string" &&
        body.displayName.trim().length > 0
          ? body.displayName.trim().slice(0, 50)
          : username;

      const { data: user, error: insertError } =
        await getSupabaseAdmin()
          .from("users")
          .insert({
            username,
            instagram_username: username,
            normalized_username: username,
            password_hash: passwordHash,
            display_name: displayName,
            bio: "",
            avatar_url: "",
          })
          .select("id, username, display_name")
          .single();

      if (insertError || !user) {
        console.error("Registration error:", insertError);

        if (insertError?.code === "23505") {
          return json(
            { error: "Username sudah digunakan." },
            409
          );
        }

        return json(
          { error: "Pendaftaran gagal." },
          500
        );
      }

      const response = json(
        {
          success: true,
          user,
        },
        201
      );

      await createSession(user.id, response);

      return response;
    }

    /* -----------------------------------------------------
       LOGIN
    ----------------------------------------------------- */

    if (action === "login") {
      /* IP LOCK CHECK */

      const ipHash = getClientIpHash(request);

      if (!ipHash) {
        return json(
          {
            error:
              "Tidak dapat memverifikasi koneksi login.",
          },
          400
        );
      }

      const {
        data: ipLockData,
        error: ipLockError,
      } = await getSupabaseAdmin().rpc(
        "ngipen_check_ip_login_lock",
        {
          p_ip_hash: ipHash,
        }
      );

      if (ipLockError) {
        console.error(
          "IP login lock check error:",
          ipLockError
        );

        return json(
          {
            error:
              "Gagal memeriksa keamanan koneksi login.",
          },
          500
        );
      }

      const ipLockStatus = Array.isArray(ipLockData)
        ? ipLockData[0]
        : ipLockData;

      if (ipLockStatus?.is_locked) {
        const minutes = Math.ceil(
          Number(ipLockStatus.remaining_seconds || 0) / 60
        );

        return json(
          {
            error: `Terlalu banyak percobaan login dari koneksi ini. Coba lagi sekitar ${minutes} menit.`,
          },
          429
        );
      }

      /* PASSWORD VALIDATION */

      if (!validLoginPassword(password)) {
        return json(
          { error: "Password tidak valid." },
          400
        );
      }

      /* USERNAME LOCK CHECK */

      const {
        data: lockData,
        error: lockError,
      } = await getSupabaseAdmin().rpc(
        "ngipen_check_login_lock",
        {
          p_username: username,
        }
      );

      if (lockError) {
        console.error(
          "Login lock check error:",
          lockError
        );

        return json(
          { error: "Gagal memeriksa keamanan login." },
          500
        );
      }

      const lockStatus = Array.isArray(lockData)
        ? lockData[0]
        : lockData;

      if (lockStatus?.is_locked) {
        const minutes = Math.ceil(
          Number(lockStatus.remaining_seconds || 0) / 60
        );

        return json(
          {
            error: `Terlalu banyak percobaan login. Coba lagi sekitar ${minutes} menit.`,
          },
          429
        );
      }

      /* FIND USER */

      const { data: user, error: loginError } =
        await getSupabaseAdmin()
          .from("users")
          .select(
            "id, username, display_name, password_hash"
          )
          .eq("normalized_username", username)
          .maybeSingle();

      if (loginError) {
        console.error(
          "Login database error:",
          loginError
        );

        return json(
          { error: "Terjadi kesalahan saat login." },
          500
        );
      }

      /* VERIFY PASSWORD */

      let passwordMatches = false;
      let storedPassword = "";

      if (user) {
        storedPassword = String(user.password_hash || "");

        if (storedPassword.startsWith("scrypt$")) {
          passwordMatches = await verifyPassword(
            password,
            storedPassword
          );
        } else {
          // Mendukung password lama sebelum migrasi.
          passwordMatches = verifyLegacyPassword(password, storedPassword);
        }
      }

      /* FAILED LOGIN */

      if (!user || !passwordMatches) {
        const {
          data: ipFailureData,
          error: ipFailureError,
        } = await getSupabaseAdmin().rpc(
          "ngipen_record_ip_login_failure",
          {
            p_ip_hash: ipHash,
          }
        );

        if (ipFailureError) {
          console.error(
            "IP login failure recording error:",
            ipFailureError
          );

          return json(
            {
              error:
                "Gagal memproses keamanan koneksi login.",
            },
            500
          );
        }

        const ipFailureStatus = Array.isArray(ipFailureData)
          ? ipFailureData[0]
          : ipFailureData;

        if (ipFailureStatus?.is_locked) {
          return json(
            {
              error:
                "Terlalu banyak percobaan login dari koneksi ini. Coba lagi dalam 15 menit.",
            },
            429
          );
        }

        const {
          data: failureData,
          error: failureError,
        } = await getSupabaseAdmin().rpc(
          "ngipen_record_login_failure",
          {
            p_username: username,
          }
        );

        if (failureError) {
          console.error(
            "Login failure recording error:",
            failureError
          );

          return json(
            { error: "Gagal memproses percobaan login." },
            500
          );
        }

        const failureStatus = Array.isArray(failureData)
          ? failureData[0]
          : failureData;

        if (failureStatus?.is_locked) {
          return json(
            {
              error:
                "Terlalu banyak percobaan login. Akun dikunci selama 15 menit.",
            },
            429
          );
        }

        return json(
          {
            error: "Username atau password salah.",
          },
          401
        );
      }

      /* LEGACY PASSWORD MIGRATION */

      let passwordMigrationPending = false;
      if (!storedPassword.startsWith("scrypt$")) {
        const newHash = await hashPassword(password);

        const { data: migratedUser, error: updateError } = await getSupabaseAdmin()
          .from("users")
          .update({
            password_hash: newHash,
          })
          .eq("id", user.id)
          .eq("password_hash", storedPassword)
          .select("id")
          .maybeSingle();

        if (updateError || !migratedUser) {
          // Keep a correct legacy login usable during transient DB write failures.
          // The plaintext fallback remains until this account can be migrated.
          passwordMigrationPending = true;
          console.error("Password hash migration failed; login will continue with migration pending.");
        }
      }

      /* RESET USERNAME LOGIN ATTEMPTS */

      let loginSecurityWarning = false;
      try {
        const { error: resetError } = await getSupabaseAdmin().rpc(
          "ngipen_reset_login_attempts",
          { p_username: username }
        );

        if (resetError) {
          loginSecurityWarning = true;
          console.error("Login attempts reset failed.");
        }
      } catch {
        loginSecurityWarning = true;
        console.error("Login attempts reset failed.");
      }

      /* RESET IP LOGIN ATTEMPTS */

      try {
        const { error: ipResetError } = await getSupabaseAdmin().rpc(
          "ngipen_reset_ip_login_attempts",
          { p_ip_hash: ipHash }
        );

        if (ipResetError) {
          loginSecurityWarning = true;
          console.error("IP login attempts reset failed.");
        }
      } catch {
        loginSecurityWarning = true;
        console.error("IP login attempts reset failed.");
      }

      /* CREATE LOGIN SESSION */

      const response = json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
        },
        ...(passwordMigrationPending ? { passwordMigrationPending: true } : {}),
        ...(loginSecurityWarning ? { loginSecurityWarning: true } : {}),
      });

      await createSession(user.id, response);

      return response;
    }

    /* UNKNOWN ACTION */

    return json(
      { error: "Aksi tidak dikenal." },
      400
    );
  } catch (error) {
    console.error("NGIPEN auth error:", error);

    return json(
      { error: "Terjadi kesalahan pada server." },
      500
    );
  }
}
