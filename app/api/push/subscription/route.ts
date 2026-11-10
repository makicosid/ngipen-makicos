import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const USER_COOKIE_NAME = "ngipen_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_TOKEN_LENGTH = 4096;

type JsonBody = Record<string, unknown>;

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function readJsonBody(request: NextRequest): Promise<JsonBody | null> {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) return null;

  const body: unknown = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  return body as JsonBody;
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

function validToken(value: unknown): value is string {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_TOKEN_LENGTH &&
    !/\\s/.test(value);
}

function isSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const body = await readJsonBody(request);
    if (!body) return json({ error: "Format data tidak valid atau terlalu besar." }, 400);

    const token = body.token;
    const platform = body.platform;
    const deviceLabel = body.deviceLabel;

    if (!validToken(token)) {
      return json({ error: "Token perangkat tidak valid." }, 400);
    }
    if (platform !== "web" && platform !== "android" && platform !== "ios") {
      return json({ error: "Platform perangkat tidak valid." }, 400);
    }
    if (deviceLabel !== undefined && (typeof deviceLabel !== "string" || deviceLabel.length > 120)) {
      return json({ error: "Nama perangkat tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthenticatedUser(request, supabase);
    if (!userId) return json({ error: "Silakan login sebagai User terlebih dahulu." }, 401);

    const now = new Date().toISOString();
    const subscription = {
      user_id: userId,
      fcm_token: token,
      platform,
      device_label: typeof deviceLabel === "string" && deviceLabel.trim()
        ? deviceLabel.trim()
        : "Browser",
      is_active: true,
      updated_at: now,
      last_seen_at: now,
      invalidated_at: null,
    };

    // Never use upsert here: an upsert on the globally unique FCM token could
    // transfer a token to another account during a concurrent registration.
    const { data: existing, error: lookupError } = await supabase
      .from("push_subscriptions")
      .select("id,user_id")
      .eq("fcm_token", token)
      .maybeSingle();

    if (lookupError) throw new Error("Gagal memeriksa token perangkat.");
    if (existing && existing.user_id !== userId) {
      return json({ error: "Token perangkat sudah terhubung ke akun lain." }, 409);
    }

    if (existing) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({
          platform: subscription.platform,
          device_label: subscription.device_label,
          is_active: true,
          updated_at: now,
          last_seen_at: now,
          invalidated_at: null,
        })
        .eq("id", existing.id)
        .eq("user_id", userId);

      if (error) throw new Error("Gagal memperbarui perangkat notifikasi.");
    } else {
      const { error } = await supabase
        .from("push_subscriptions")
        .insert(subscription);

      if (error?.code === "23505") {
        // A second request may have inserted this token after our initial lookup.
        const { data: raced, error: raceLookupError } = await supabase
          .from("push_subscriptions")
          .select("id,user_id")
          .eq("fcm_token", token)
          .maybeSingle();

        if (raceLookupError) throw new Error("Gagal memverifikasi kepemilikan token.");
        if (!raced || raced.user_id !== userId) {
          return json({ error: "Token perangkat sudah terhubung ke akun lain." }, 409);
        }

        const { error: updateError } = await supabase
          .from("push_subscriptions")
          .update({
            platform: subscription.platform,
            device_label: subscription.device_label,
            is_active: true,
            updated_at: now,
            last_seen_at: now,
            invalidated_at: null,
          })
          .eq("id", raced.id)
          .eq("user_id", userId);

        if (updateError) throw new Error("Gagal memperbarui perangkat notifikasi.");
      } else if (error) {
        throw new Error("Gagal menyimpan perangkat notifikasi.");
      }
    }

    return json({ success: true });
  } catch (error) {
    console.error("Push subscription POST failed:", error);
    return json({ error: "Terjadi kesalahan saat mendaftarkan notifikasi." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const body = await readJsonBody(request);
    if (!body || !validToken(body.token)) {
      return json({ error: "Token perangkat tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();
    const userId = await getAuthenticatedUser(request, supabase);
    if (!userId) return json({ error: "Silakan login sebagai User terlebih dahulu." }, 401);

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ is_active: false, invalidated_at: now, updated_at: now })
      .eq("user_id", userId)
      .eq("fcm_token", body.token);

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
