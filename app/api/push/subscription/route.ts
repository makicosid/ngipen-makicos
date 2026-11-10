import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const USER_COOKIE_NAME = "ngipen_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getAuthenticatedUser(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const sessionToken = request.cookies.get(USER_COOKIE_NAME)?.value;
  if (!sessionToken) return null;

  const { data, error } = await supabase
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(sessionToken))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error("Gagal memeriksa sesi pengguna.");
  if (!data?.user_id || !UUID_PATTERN.test(data.user_id)) return null;

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("id", data.user_id)
    .maybeSingle();

  if (userError) throw new Error("Gagal memeriksa akun pengguna.");
  return user?.id ? String(user.id) : null;
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthenticatedUser(request, supabase);
    if (!userId) return json({ error: "Silakan login sebagai User terlebih dahulu." }, 401);

    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const platform = body.platform === "ios" || body.platform === "android" ? body.platform : "web";
    const deviceLabel = typeof body.deviceLabel === "string" ? body.deviceLabel.trim().slice(0, 120) : "";

    if (!token || token.length > 4096 || /\s/.test(token)) {
      return json({ error: "Token perangkat tidak valid." }, 400);
    }

    const { data: existingToken, error: lookupError } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .eq("fcm_token", token)
      .maybeSingle();

    if (lookupError) throw new Error("Gagal memeriksa token perangkat.");
    if (existingToken && existingToken.user_id !== userId) {
      return json({ error: "Token perangkat sudah terhubung ke akun lain." }, 409);
    }

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        fcm_token: token,
        platform,
        device_label: deviceLabel || "Browser",
        is_active: true,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        invalidated_at: null,
      },
      { onConflict: "fcm_token" }
    );

    if (error) {
      console.error("Push subscription save failed:", error.code);
      return json({ error: "Gagal menyimpan perangkat notifikasi." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Push subscription POST failed:", error);
    return json({ error: "Terjadi kesalahan saat mendaftarkan notifikasi." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthenticatedUser(request, supabase);
    if (!userId) return json({ error: "Silakan login sebagai User terlebih dahulu." }, 401);

    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token || token.length > 4096) return json({ error: "Token perangkat tidak valid." }, 400);

    const { error } = await supabase
      .from("push_subscriptions")
      .update({ is_active: false, invalidated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("fcm_token", token);

    if (error) {
      console.error("Push subscription deactivate failed:", error.code);
      return json({ error: "Gagal menonaktifkan perangkat notifikasi." }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Push subscription DELETE failed:", error);
    return json({ error: "Terjadi kesalahan saat menonaktifkan notifikasi." }, 500);
  }
}
