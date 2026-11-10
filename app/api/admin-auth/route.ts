import { readJsonObjectWithinLimit } from "../../../lib/request-body";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  randomBytes,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "crypto";
import { promisify } from "util";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_admin_session";
const SESSION_DAYS = 30;
const scrypt = promisify(scryptCallback);

async function hashAdminPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(pin, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyAdminPin(pin: string, storedValue: string) {
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(storedValue);
  if (!match) return false;

  try {
    const [, salt, savedKey] = match;
    const derivedKey = (await scrypt(pin, salt, 64)) as Buffer;
    const savedBuffer = Buffer.from(savedKey, "hex");
    return savedBuffer.length === derivedKey.length && timingSafeEqual(savedBuffer, derivedKey);
  } catch {
    return false;
  }
}

function verifyLegacyAdminPin(pin: string, storedValue: string) {
  const pinBuffer = Buffer.from(pin, "utf8");
  const storedBuffer = Buffer.from(storedValue, "utf8");
  return pinBuffer.length === storedBuffer.length && timingSafeEqual(pinBuffer, storedBuffer);
}


function getAttemptKey(request: NextRequest, username: string) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || "unknown";

  return createHash("sha256")
    .update(`${ip}:${username.toLowerCase()}`)
    .digest("hex");
}



async function checkAndRecordLoginAttempt(
  request: NextRequest,
  username: string
) {
  const attemptKey = getAttemptKey(request, username);

  const { data, error } = await getSupabaseAdmin()
    .rpc("check_admin_login_limit", {
      p_attempt_key: attemptKey,
    });

  if (error) {
    console.error("Login rate limit error:", error);
    throw new Error("Gagal memeriksa batas percobaan login.");
  }

  return data === true;
}

async function clearLoginAttempts(
  request: NextRequest,
  username: string
) {
  const attemptKey = getAttemptKey(request, username);

  try {
    const { error } = await getSupabaseAdmin()
      .from("admin_login_attempts")
      .delete()
      .eq("attempt_key", attemptKey);

    if (error) {
      console.error("Login attempt cleanup failed.");
      return false;
    }

    return true;
  } catch {
    console.error("Login attempt cleanup failed.");
    return false;
  }
}
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function createAdminSession(response: NextResponse) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  );

  const { error } = await getSupabaseAdmin()
    .from("admin_sessions")
    .insert({
      token_hash: hashToken(token),
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error("Admin session creation error:", error);
    throw new Error("Gagal membuat sesi admin.");
  }

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return json({ authenticated: false }, 401);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return json({ authenticated: false }, 401);
    }

    return json({ authenticated: true, role: "admin" });
  } catch (error) {
    console.error("Admin session check error:", error);
    return json({ error: "Gagal memeriksa sesi admin." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const parsedBody = await readJsonObjectWithinLimit(request);
    if (!parsedBody.ok) {
      return json(
        { error: parsedBody.reason === "too_large" ? "Ukuran permintaan terlalu besar." : "Format permintaan tidak valid." },
        parsedBody.reason === "too_large" ? 413 : 400
      );
    }
    const body = parsedBody.value;
    const supabase = getSupabaseAdmin();

   if (body.action === "logout") {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (token) {
    const { error } = await supabase
      .from("admin_sessions")
      .delete()
      .eq("token_hash", hashToken(token));

    if (error) {
      console.error("Admin logout error:", error);

      const response = json(
        { error: "Gagal menghapus sesi admin." },
        500
      );

      response.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });

      return response;
    }
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

    if (body.action !== "login") {
      return json({ error: "Aksi tidak dikenal." }, 400);
    }

    const username =
      typeof body.username === "string"
        ? body.username.trim()
        : "";

    const pin =
      typeof body.pin === "string"
        ? body.pin.trim()
        : "";

   if (!username || !/^\d{4}$/.test(pin)) {
      return json(
        { error: "Username atau format PIN tidak valid." },
        400
      );
    }
   const loginAllowed = await checkAndRecordLoginAttempt(request, username);

if (!loginAllowed) {
  return json(
    {
      error:
        "Terlalu banyak percobaan login. Coba lagi setelah 15 menit.",
    },
    429
  );
}
    const { data, error } = await supabase
      .from("admin_settings")
      .select("id, username, pin_hash")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Admin credential lookup error:", error);
      return json({ error: "Gagal memeriksa login admin." }, 500);
    }

    if (!data) {
      return json(
        { error: "Username atau PIN admin salah." },
        401
      );
    }

    const storedPinValue = String(data.pin_hash || "");
    const isHashedPin = storedPinValue.startsWith("scrypt$");
    const pinMatches = isHashedPin
      ? await verifyAdminPin(pin, storedPinValue)
      : verifyLegacyAdminPin(pin, storedPinValue);

    if (!pinMatches) {
      return json(
        { error: "Username atau PIN admin salah." },
        401
      );
    }

    if (!isHashedPin) {
      const upgradedPinHash = await hashAdminPin(pin);
      const { data: migratedAdmin, error: migrationError } = await supabase
        .from("admin_settings")
        .update({ pin_hash: upgradedPinHash })
        .eq("id", data.id)
        .eq("pin_hash", storedPinValue)
        .select("id")
        .maybeSingle();

      if (migrationError) {
        console.error("Admin PIN upgrade failed; login blocked until the credential can be secured.");
        return json(
          { error: "Gagal mengamankan kredensial admin. Silakan coba lagi." },
          503
        );
      }

      if (!migratedAdmin) {
        const { data: currentAdmin, error: currentAdminError } = await supabase
          .from("admin_settings")
          .select("pin_hash")
          .eq("id", data.id)
          .maybeSingle();

        const currentPinValue = String(currentAdmin?.pin_hash || "");
        if (
          currentAdminError ||
          !currentPinValue.startsWith("scrypt$") ||
          !(await verifyAdminPin(pin, currentPinValue))
        ) {
          console.error("Admin PIN upgrade lost a concurrent update; login denied.");
          return json(
            { error: "Gagal memverifikasi perubahan kredensial admin. Silakan coba lagi." },
            503
          );
        }
      }
    }
    
    const loginSecurityWarning = !(await clearLoginAttempts(request, username));
    
    const response = json({
      success: true,
      authenticated: true,
      role: "admin",
      ...(loginSecurityWarning ? { loginSecurityWarning: true } : {}),
    });

    await createAdminSession(response);

    return response;
  } catch (error) {
    console.error("Admin authentication error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
