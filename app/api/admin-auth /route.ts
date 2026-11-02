
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_admin_session";
const SESSION_DAYS = 30;

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

    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (body.action === "logout") {
      const token = request.cookies.get(COOKIE_NAME)?.value;

      if (token) {
        await supabase
          .from("admin_sessions")
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

    const { data, error } = await supabase
      .from("admin_settings")
      .select("username, pin_hash")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      console.error("Admin credential lookup error:", error);
      return json({ error: "Gagal memeriksa login admin." }, 500);
    }

    if (!data || String(data.pin_hash) !== pin) {
      return json(
        { error: "Username atau PIN admin salah." },
        401
      );
    }

    const response = json({
      success: true,
      authenticated: true,
      role: "admin",
    });

    await createAdminSession(response);

    return response;
  } catch (error) {
    console.error("Admin authentication error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
