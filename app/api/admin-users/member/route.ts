import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function PATCH(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) return json({ error: "Permintaan tidak diizinkan." }, 403);
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return json({ error: "Sesi admin tidak valid." }, 401);

    const supabase = getSupabaseAdmin();
    const { data: adminSession, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (sessionError || !adminSession) return json({ error: "Sesi admin tidak valid. Silakan login kembali." }, 401);

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!UUID_PATTERN.test(userId) || typeof body.isMember !== "boolean") return json({ error: "Data membership tidak valid." }, 400);

    // Status member hanya mengendalikan frame KARTU profil. Jangan mengubah pilihan frame avatar pengguna.
    const { data: user, error } = await supabase
      .from("users")
      .update({ is_makicos_member: body.isMember })
      .eq("id", userId)
      .select("id, is_makicos_member, selected_frame_key")
      .maybeSingle();
    if (error) {
      console.error("Admin membership update failed:", error);
      return json({ error: "Gagal memperbarui status membership." }, 500);
    }
    if (!user) return json({ error: "Pengguna tidak ditemukan." }, 404);
    return json({ success: true, user_id: user.id, is_makicos_member: Boolean(user.is_makicos_member), selected_frame_key: user.selected_frame_key || "free_red" });
  } catch (error) {
    console.error("Admin membership API error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}
