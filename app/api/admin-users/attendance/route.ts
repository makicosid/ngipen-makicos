import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
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

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function isAdminAuthenticated(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error("Gagal memeriksa sesi admin.");
  return Boolean(data);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated(request, getSupabaseAdmin()))) {
      return json({ error: "Sesi admin tidak valid. Silakan login kembali." }, 401);
    }

    const userId = request.nextUrl.searchParams.get("userId")?.trim() || "";
    if (!UUID_PATTERN.test(userId)) return json({ error: "ID pengguna tidak valid." }, 400);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("event_attendance")
      .select("id,event_id,attendance_status,created_at,updated_at,events!fk_event_attendance_event(id,title,start_date,end_date,city,province),event_attendance_days(event_date)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin attendance history query error:", error);
      return json({ error: "Gagal mengambil riwayat pilihan absensi pengguna." }, 500);
    }

    const attendance = (data || [])
      .filter((row: any) => row.events)
      .map((row: any) => {
        const event = Array.isArray(row.events) ? row.events[0] : row.events;
        const days = Array.isArray(row.event_attendance_days)
          ? row.event_attendance_days
              .map((item: { event_date?: string }) => item.event_date)
              .filter((value: unknown): value is string => typeof value === "string")
              .sort()
          : [];

        return {
          attendanceId: row.id,
          eventId: row.event_id,
          attendanceStatus: row.attendance_status,
          selectedDates: days,
          submittedAt: row.created_at,
          updatedAt: row.updated_at,
          event: {
            id: event.id,
            title: event.title,
            startDate: event.start_date,
            endDate: event.end_date,
            city: event.city,
            province: event.province,
          },
        };
      })
      .sort((a, b) => {
        const aDate = a.event.startDate || "";
        const bDate = b.event.startDate || "";
        return bDate.localeCompare(aDate) || String(b.submittedAt || "").localeCompare(String(a.submittedAt || ""));
      });

    return json({ success: true, userId, total: attendance.length, attendance });
  } catch (error) {
    console.error("Admin attendance history API error:", error);
    return json({
      error: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
    }, 500);
  }
}
