import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export function adminJson(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get("ngipen_admin_session")?.value;
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return supabase;
}

export function isSameOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}
