import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DeleteTarget = "Rejected" | "Completed";

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

function isEventCompleted(event: {
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
}) {
  if (!event.start_date || !event.end_date) return false;
  const endTime = event.end_time || "23:59:59";
  const end = new Date(`${event.end_date}T${endTime}+07:00`);
  return !Number.isNaN(end.getTime()) && Date.now() >= end.getTime();
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) {
      return json({ success: false, error: "Origin tidak diizinkan." }, 403);
    }

    const supabase = getSupabaseAdmin();
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return json({ success: false, error: "Sesi admin tidak valid." }, 401);

    const { data: session, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError) {
      console.error("Bulk delete session check error:", sessionError);
      return json({ success: false, error: "Gagal memeriksa sesi admin." }, 500);
    }
    if (!session) return json({ success: false, error: "Sesi admin tidak valid atau telah berakhir." }, 401);

    let body: { ids?: unknown; target?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "Format JSON tidak valid." }, 400);
    }

    if (body.target !== "Rejected" && body.target !== "Completed") {
      return json({ success: false, error: "Target penghapusan tidak valid." }, 400);
    }
    const target = body.target as DeleteTarget;
    if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 500) {
      return json({ success: false, error: "Pilih antara 1 sampai 500 event." }, 400);
    }
    const ids = Array.from(new Set(body.ids));
    if (ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
      return json({ success: false, error: "Terdapat ID event yang tidak valid." }, 400);
    }

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, moderation_status, start_date, end_date, start_time, end_time")
      .in("id", ids as string[]);
    if (eventsError) {
      console.error("Bulk delete event lookup error:", eventsError);
      return json({ success: false, error: "Gagal memeriksa event." }, 500);
    }

    const eligible = (events || []).filter((event) =>
      target === "Rejected"
        ? event.moderation_status === "Rejected"
        : isEventCompleted(event)
    );
    const eligibleIds = eligible.map((event) => String(event.id));
    const skipped = ids.length - eligibleIds.length;
    if (eligibleIds.length === 0) {
      return json({ success: true, deletedIds: [], blocked: [], skipped });
    }

    // Penting: FK saat ini memakai ON DELETE CASCADE. Periksa semua tabel anak
    // lebih dulu dan blokir event yang masih memiliki data terkait agar tidak
    // menghapus dokumentasi, simpanan, atau riwayat klik secara tidak sengaja.
    const [docsResult, savesResult, viewsResult] = await Promise.all([
      supabase.from("event_documentations").select("event_id").in("event_id", eligibleIds),
      supabase.from("event_saves").select("event_id").in("event_id", eligibleIds),
      supabase.from("event_views").select("event_id").in("event_id", eligibleIds),
    ]);

    const dependencyErrors = [docsResult.error, savesResult.error, viewsResult.error].filter(Boolean);
    if (dependencyErrors.length) {
      console.error("Bulk delete dependency check error:", dependencyErrors);
      return json({ success: false, error: "Gagal memeriksa data terkait. Tidak ada event yang dihapus." }, 500);
    }

    const dependencyMap = new Map<string, { documentations: number; saves: number; views: number }>();
    for (const id of eligibleIds) dependencyMap.set(id, { documentations: 0, saves: 0, views: 0 });
    for (const row of docsResult.data || []) {
      const item = dependencyMap.get(String(row.event_id));
      if (item) item.documentations += 1;
    }
    for (const row of savesResult.data || []) {
      const item = dependencyMap.get(String(row.event_id));
      if (item) item.saves += 1;
    }
    for (const row of viewsResult.data || []) {
      const item = dependencyMap.get(String(row.event_id));
      if (item) item.views += 1;
    }

    const blocked = Array.from(dependencyMap.entries())
      .filter(([, counts]) => counts.documentations + counts.saves + counts.views > 0)
      .map(([id, counts]) => ({ id, ...counts }));
    const blockedIds = new Set(blocked.map((item) => item.id));
    const safeIds = eligibleIds.filter((id) => !blockedIds.has(id));

    const deletedIds: string[] = [];
    // Delete satu per satu supaya hasil parsial dapat dilaporkan secara akurat.
    for (const id of safeIds) {
      const { data: deleted, error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (deleteError) {
        console.error("Bulk delete event row error:", id, deleteError);
        continue;
      }
      if (deleted?.id) deletedIds.push(String(deleted.id));
    }

    return json({
      success: true,
      deletedIds,
      blocked,
      skipped,
      failed: safeIds.length - deletedIds.length,
    });
  } catch (error) {
    console.error("Bulk delete API error:", error);
    return json({ success: false, error: "Terjadi kesalahan pada server." }, 500);
  }
}
