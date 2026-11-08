import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
const ADMIN_COOKIE_NAME = "ngipen_admin_session";

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hasValidAdminSession(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  const { data, error } = await supabase.from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    console.error("Legacy completed-event deletion session check error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }
  return Boolean(data);
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) return json({ error: "Origin request tidak valid." }, 403);
    const supabase = getSupabaseAdmin();
    if (!(await hasValidAdminSession(request, supabase))) {
      return json({ error: "Sesi admin tidak valid atau sudah berakhir." }, 401);
    }
    return json({
      error: "Penghapusan langsung event Completed sudah dinonaktifkan. Gunakan fitur Event Cleanup agar retensi, Storage, dan audit diperiksa.",
    }, 410);
  } catch (error) {
    console.error("Legacy completed-event deletion endpoint error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
