import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const USER_COOKIE_NAME = "ngipen_session";
const ADMIN_COOKIE_NAME = "ngipen_admin_session";

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

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

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hasValidAdminSession(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Event API admin session check error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }

  return Boolean(data);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const isAdmin = await hasValidAdminSession(request, supabase);

    let query = supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    // Pengunjung dan user biasa hanya menerima event yang sudah disetujui.
    // Sesi admin yang valid tetap dapat melihat seluruh event untuk moderasi.
    if (!isAdmin) {
      query = query.eq("moderation_status", "Approved");
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Get events API error:", error);
      return json({ error: "Gagal memuat data event." }, 500);
    }

    return json({ success: true, events: events || [] });
  } catch (error) {
    console.error("Events API error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
