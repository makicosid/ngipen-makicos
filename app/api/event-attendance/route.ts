import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const USER_COOKIE_NAME = "ngipen_session";
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
  if (!url || !key) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getUserSession(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = request.cookies.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const { data, error } = await supabase
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error("Gagal memeriksa sesi pengguna.");
  return data;
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

  if (error) throw new Error("Gagal memeriksa sesi admin.");
  return Boolean(data);
}

function getEventTimezone(province: string): string {
  const normalized = province.trim().toLocaleLowerCase("id-ID");

  const wita = new Set([
    "bali",
    "nusa tenggara barat",
    "nusa tenggara timur",
    "kalimantan selatan",
    "kalimantan timur",
    "kalimantan utara",
    "sulawesi utara",
    "sulawesi tengah",
    "sulawesi selatan",
    "sulawesi tenggara",
    "gorontalo",
    "sulawesi barat",
  ]);

  const wit = new Set([
    "maluku",
    "maluku utara",
    "papua",
    "papua barat",
    "papua selatan",
    "papua tengah",
    "papua pegunungan",
    "papua barat daya",
  ]);

  if (wita.has(normalized)) return "Asia/Makassar";
  if (wit.has(normalized)) return "Asia/Jayapura";
  return "Asia/Jakarta";
}

function getLocalDateTime(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

function isPollOpen(startDate: string, startTime: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{2}:\d{2}(:\d{2})?$/.test(startTime)) {
    return false;
  }

  const localNow = getLocalDateTime(new Date(), timeZone);
  const normalizedStartTime = startTime.length === 5 ? `${startTime}:00` : startTime;
  return localNow < `${startDate}T${normalizedStartTime}`;
}

async function getEvent(eventId: string, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from("events")
    .select("id, start_date, end_date, start_time, province, moderation_status, is_hidden")
    .eq("id", eventId)
    .maybeSingle();

  if (error) throw new Error("Gagal memeriksa data event.");
  return data;
}

async function getExistingAttendance(eventId: string, userId: string, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data, error } = await supabase
    .from("event_attendance")
    .select("attendance_status, event_attendance_days(event_date)")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error("Gagal mengambil respons absensi pribadi.");

  const days = Array.isArray(data?.event_attendance_days)
    ? data.event_attendance_days.map((item: { event_date: string }) => item.event_date)
    : [];

  return data ? { attendance_status: data.attendance_status, event_dates: days } : null;
}

export async function GET(request: NextRequest) {
  try {
    const eventId = request.nextUrl.searchParams.get("eventId")?.trim() || "";
    if (!UUID_PATTERN.test(eventId)) return json({ error: "Event tidak valid." }, 400);

    const supabase = getSupabaseAdmin();
    const isAdmin = await hasValidAdminSession(request, supabase);
    const session = isAdmin ? null : await getUserSession(request, supabase);

    if (!isAdmin && !session) {
      return json({ error: "Silakan login untuk melihat daftar kehadiran." }, 401);
    }

    const event = await getEvent(eventId, supabase);
    if (!event || (!isAdmin && (event.moderation_status !== "Approved" || event.is_hidden !== false))) {
      return json({ error: "Event tidak ditemukan." }, 404);
    }

    const timezone = getEventTimezone(String(event.province || ""));
    const { data, error } = await supabase.rpc("ngipen_get_event_attendance", {
      p_event_id: eventId,
    });

    if (error) {
      console.error("Attendance read RPC failed:", error);
      return json({ error: "Gagal mengambil daftar kehadiran." }, 500);
    }

    const attendancePayload = data && typeof data === "object" ? data as Record<string, any> : {};
    const participants = Array.isArray(attendancePayload.participants) ? attendancePayload.participants : [];
    const participantIds = Array.from(new Set(participants.map((item: any) => String(item.user_id || "")).filter(Boolean)));
    if (participantIds.length) {
      const { data: profiles, error: profileError } = await supabase.from("users").select("id, selected_frame_key").in("id", participantIds);
      if (profileError) return json({ error: "Gagal mengambil frame profil peserta." }, 500);
      const frameByUser = new Map<string, string>((profiles || []).map((profile: any) => [String(profile.id), String(profile.selected_frame_key || "free_red")] as [string, string]));
      attendancePayload.participants = participants.map((participant: any) => ({ ...participant, selected_frame_key: frameByUser.get(String(participant.user_id)) || "free_red" }));
    }

    let ownAttendance = null;
    if (session?.user_id) {
      ownAttendance = await getExistingAttendance(eventId, session.user_id, supabase);
    }

    return json({
      success: true,
      attendance: attendancePayload,
      ownAttendance,
      pollOpen: isPollOpen(String(event.start_date || ""), String(event.start_time || ""), timezone),
      timezone,
      startDate: event.start_date,
      startTime: event.start_time,
      endDate: event.end_date,
    });
  } catch (error) {
    console.error("Event attendance GET error:", error);
    return json({ error: "Terjadi kesalahan saat mengambil data kehadiran." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const supabase = getSupabaseAdmin();

    // Admin has a separate session with no users.id mapping. Never let an
    // admin cookie be used to submit attendance for an arbitrary account.
    if (await hasValidAdminSession(request, supabase)) {
      return json({ error: "Admin hanya dapat melihat daftar kehadiran." }, 403);
    }

    const session = await getUserSession(request, supabase);
    if (!session?.user_id) {
      return json({ error: "Silakan login sebagai User terlebih dahulu." }, 401);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError || !user) {
      return json({ error: "Sesi pengguna tidak valid. Silakan login kembali." }, 401);
    }

    const originEventId = request.headers.get("origin");
    if (!originEventId) return json({ error: "Permintaan tidak diizinkan." }, 403);

    const body = await request.json();
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const attendanceStatus = body.attendanceStatus;
    const eventDates = body.eventDates;

    if (!UUID_PATTERN.test(eventId)) return json({ error: "Event tidak valid." }, 400);
    if (attendanceStatus !== "attending" && attendanceStatus !== "not_attending") {
      return json({ error: "Pilihan kehadiran tidak valid." }, 400);
    }
    if (!Array.isArray(eventDates) || eventDates.length > 366 ||
        eventDates.some((date: unknown) => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
      return json({ error: "Daftar tanggal kehadiran tidak valid." }, 400);
    }
    if (attendanceStatus === "not_attending" && eventDates.length > 0) {
      return json({ error: "Status Tidak Hadir tidak boleh memiliki tanggal." }, 400);
    }
    if (attendanceStatus === "attending" && eventDates.length === 0) {
      return json({ error: "Pilih minimal satu tanggal kehadiran." }, 400);
    }

    const event = await getEvent(eventId, supabase);
    if (!event || event.moderation_status !== "Approved" || event.is_hidden !== false) {
      return json({ error: "Event tidak ditemukan." }, 404);
    }

    const timezone = getEventTimezone(String(event.province || ""));
    const { data, error } = await supabase.rpc("ngipen_submit_event_attendance", {
      p_user_id: session.user_id,
      p_event_id: eventId,
      p_attendance_status: attendanceStatus,
      p_event_dates: eventDates,
      p_event_timezone: timezone,
    });

    if (error) {
      const message = String(error.message || "");
      if (/polling kehadiran sudah ditutup/i.test(message)) {
        return json({ error: "Polling kehadiran sudah ditutup." }, 409);
      }
      if (/tanggal|pilih minimal|status kehadiran/i.test(message)) {
        return json({ error: message }, 400);
      }
      console.error("Attendance submit RPC failed:", error);
      return json({ error: "Gagal menyimpan pilihan kehadiran." }, 500);
    }

    return json({ success: true, result: data });
  } catch (error) {
    console.error("Event attendance POST error:", error);
    return json({ error: "Terjadi kesalahan saat menyimpan kehadiran." }, 500);
  }
}
