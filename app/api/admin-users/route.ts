import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
const PAGE_SIZE = 1000;

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

function safeSocialUrl(value: string | null, platform: "instagram" | "tiktok") {
  if (!value) return "";
  try {
    const url = new URL(value);
    const hosts = platform === "instagram"
      ? ["instagram.com", "www.instagram.com"]
      : ["tiktok.com", "www.tiktok.com"];
    if (url.protocol !== "https:" || url.username || url.password ||
        !hosts.includes(url.hostname.toLowerCase()) ||
        url.pathname.replace(/\/+$/, "").length < 2) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function isAdminAuthenticated(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) return false;

  const { data, error } = await getSupabaseAdmin()
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return !error && Boolean(data);
}

async function fetchAllAttendanceRows(): Promise<Array<{
  user_id: string | null;
  event_id: string | null;
  attendance_status: string | null;
}>> {
  const supabase = getSupabaseAdmin();
  const rows: Array<{
    user_id: string | null;
    event_id: string | null;
    attendance_status: string | null;
  }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("event_attendance")
      .select("user_id,event_id,attendance_status")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Admin event_attendance query error:", error);
      throw new Error("Gagal mengambil statistik event dikunjungi.");
    }

    const page = data || [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function fetchAllRows(
  table: "event_saves" | "event_views"
): Promise<Array<{ user_id: string | null }>> {
  const supabase = getSupabaseAdmin();
  const rows: Array<{ user_id: string | null }> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("user_id")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Admin ${table} query error:`, error);
      throw new Error(
        table === "event_saves"
          ? "Gagal mengambil statistik event tersimpan."
          : "Gagal mengambil statistik kunjungan event."
      );
    }

    const page = data || [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated(request))) {
      return json(
        { error: "Sesi admin tidak valid. Silakan login kembali." },
        401
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id,username,display_name,bio,avatar_url,instagram_url,tiktok_url,created_at,is_makicos_member,selected_frame_key")
      .order("created_at", { ascending: false });

    if (usersError) {
      console.error("Admin users query error:", usersError);
      return json({ error: "Gagal mengambil daftar pengguna." }, 500);
    }

    const [savedRows, viewRows, attendanceRows] = await Promise.all([
      fetchAllRows("event_saves"),
      fetchAllRows("event_views"),
      fetchAllAttendanceRows(),
    ]);

    const savedCounts = new Map<string, number>();
    const viewCounts = new Map<string, number>();
    const attendedEventIdsByUser = new Map<string, Set<string>>();

    for (const row of savedRows) {
      if (!row.user_id) continue;
      savedCounts.set(
        row.user_id,
        (savedCounts.get(row.user_id) || 0) + 1
      );
    }

    for (const row of viewRows) {
      if (!row.user_id) continue;
      viewCounts.set(
        row.user_id,
        (viewCounts.get(row.user_id) || 0) + 1
      );
    }

    // Hitung event unik yang dipilih dengan status Hadir, bukan sekadar klik atau simpan.
    for (const row of attendanceRows) {
      if (!row.user_id || !row.event_id || row.attendance_status !== "attending") continue;
      const eventIds = attendedEventIdsByUser.get(row.user_id) || new Set<string>();
      eventIds.add(row.event_id);
      attendedEventIdsByUser.set(row.user_id, eventIds);
    }

    const result = (users || []).map((user) => ({
      ...user,
      instagram_url: safeSocialUrl(user.instagram_url, "instagram"),
      tiktok_url: safeSocialUrl(user.tiktok_url, "tiktok"),
      savedEventsCount: savedCounts.get(user.id) || 0,
      totalClicks: viewCounts.get(user.id) || 0,
      attendedEventsCount: attendedEventIdsByUser.get(user.id)?.size || 0,
    }));

    return json({
      success: true,
      users: result,
    });
  } catch (error) {
    console.error("Admin users API error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server.",
      },
      500
    );
  }
}
