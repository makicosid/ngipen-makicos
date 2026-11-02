
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "crypto";
import { promisify } from "util";

export const runtime = "nodejs";

const scrypt = promisify(scryptCallback);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Konfigurasi Supabase server belum lengkap.");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const COOKIE_NAME = "ngipen_session";
const SESSION_DAYS = 30;

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

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
  return value.length >= 8 && value.length <= 128;
}

function validLoginPassword(value: string) {
  return value.length >= 1 && value.length <= 128;
}

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
  if (parts.length !== 3) return false;

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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(userId: string, response: NextResponse) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error } = await supabaseAdmin
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

  if (!token) return null;

  const tokenHash = hashToken(token);

  const { data, error } = await supabaseAdmin
    .from("ngipen_sessions")
    .select("user_id, expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return json({ authenticated: false }, 401);
    }

    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("id, username, display_name")
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
    return json({ error: "Gagal memeriksa sesi." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    // LOGOUT
    if (action === "logout") {
      const token = request.cookies.get(COOKIE_NAME)?.value;

      if (token) {
        await supabaseAdmin
          .from("ngipen_sessions")
          .delete()
          .eq("token_hash", hashToken(token));
      }

      const response = json({ success: true });

      response.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    }

    // USERNAME DAN PASSWORD
    const username =
      typeof body.username === "string"
        ? normalizeUsername(body.username)
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!validUsername(username)) {
      return json({ error: "Username tidak valid." }, 400);
    }

    // REGISTER
    if (action === "register") {
      if (!validNewPassword(password)) {
        return json(
          { error: "Password harus terdiri dari 8–128 karakter." },
          400
        );
      }

      const { data: existing, error: checkError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("normalized_username", username)
        .maybeSingle();

      if (checkError) {
        console.error("Username check error:", checkError);
        return json({ error: "Gagal memeriksa username." }, 500);
      }

      if (existing) {
        return json({ error: "Username sudah digunakan." }, 409);
      }

      const passwordHash = await hashPassword(password);

      const displayName =
        typeof body.displayName === "string" &&
        body.displayName.trim().length > 0
          ? body.displayName.trim().slice(0, 50)
          : username;

      const { data: user, error: insertError } = await supabaseAdmin
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
          return json({ error: "Username sudah digunakan." }, 409);
        }

        return json({ error: "Pendaftaran gagal." }, 500);
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

    // LOGIN
    if (action === "login") {
      if (!validLoginPassword(password)) {
        return json(
          { error: "Password tidak valid." },
          400
        );
      }

      const { data: user, error: loginError } = await supabaseAdmin
        .from("users")
        .select("id, username, display_name, password_hash")
        .eq("normalized_username", username)
        .maybeSingle();

      if (loginError || !user) {
        return json(
          { error: "Username atau password salah." },
          401
        );
      }

      const storedPassword = String(user.password_hash || "");
      let passwordMatches = false;

      if (storedPassword.startsWith("scrypt$")) {
        passwordMatches = await verifyPassword(
          password,
          storedPassword
        );
      } else {
        // Migrasi password lama setelah login berhasil.
        passwordMatches = storedPassword === password;

        if (passwordMatches) {
          const newHash = await hashPassword(password);

          const { error: updateError } = await supabaseAdmin
            .from("users")
            .update({
              password_hash: newHash,
            })
            .eq("id", user.id);

          if (updateError) {
            console.error("Password migration error:", updateError);

            return json(
              { error: "Gagal memperbarui keamanan password." },
              500
            );
          }
        }
      }

      if (!passwordMatches) {
        return json(
          { error: "Username atau password salah." },
          401
        );
      }

      const response = json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
        },
      });

      await createSession(user.id, response);

      return response;
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("NGIPEN auth error:", error);

    return json(
      { error: "Terjadi kesalahan pada server." },
      500
    );
  }
}
