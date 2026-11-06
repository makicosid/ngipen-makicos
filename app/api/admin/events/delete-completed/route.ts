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

async function hasValidAdminSession(
  request: NextRequest,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Delete completed event session check error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }

  return Boolean(data);
}

function isEventCompleted(event: {
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
}) {
  const now = new Date();

  const startTime = event.start_time || "00:00:00";
  const endTime = event.end_time || "23:59:59";

  const start = new Date(`${event.start_date}T${startTime}+07:00`);
  const end = new Date(`${event.end_date}T${endTime}+07:00`);

  if (
    !event.start_date ||
    !event.end_date ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return false;
  }

  return now >= end;
}

export async function POST(request: NextRequest) {
  try {
    // Tolak request yang tidak berasal dari origin aplikasi.
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Origin request tidak valid." }, 403);
    }

    const supabase = getSupabaseAdmin();

    const isAdmin = await hasValidAdminSession(request, supabase);

    if (!isAdmin) {
      return json({ error: "Sesi admin tidak valid atau sudah berakhir." }, 401);
    }

    let body: { id?: string };

    try {
      body = await request.json();
    } catch {
      return json({ error: "Format request tidak valid." }, 400);
    }

    const eventId = body.id?.trim();

    if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      return json({ error: "ID event tidak valid." }, 400);
    }

    // Ambil tanggal dan waktu event dari database, bukan dari data browser.
    const { data: event, error: fetchError } = await supabase
      .from("events")
      .select("id, start_date, end_date, start_time, end_time")
      .eq("id", eventId)
      .maybeSingle();

    if (fetchError) {
      console.error("Fetch event before deletion error:", fetchError);
      return json({ error: "Gagal memeriksa data event." }, 500);
    }

    if (!event) {
      return json({ error: "Event tidak ditemukan." }, 404);
    }

    if (!isEventCompleted(event)) {
      return json(
        { error: "Event belum selesai dan tidak dapat dihapus." },
        409
      );
    }

    // FK terkait menggunakan ON DELETE CASCADE.
    // Karena itu, blokir penghapusan jika masih ada data terkait.
    const [docs, saves, views] = await Promise.all([
      supabase
        .from("event_documentations")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId),
      supabase
        .from("event_saves")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId),
      supabase
        .from("event_views")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId),
    ]);

    if (docs.error || saves.error || views.error) {
      console.error(
        "Completed event dependency check error:",
        docs.error || saves.error || views.error
      );
      return json(
        { error: "Gagal memeriksa data terkait. Event tidak dihapus." },
        500
      );
    }

    const dependencies = {
      documentations: docs.count || 0,
      saves: saves.count || 0,
      views: views.count || 0,
    };

    if (
      dependencies.documentations +
        dependencies.saves +
        dependencies.views >
      0
    ) {
      return json(
        {
          error:
            "Event belum dapat dihapus karena masih memiliki data terkait.",
          dependencies,
        },
        409
      );
    }

    const { data: deletedEvent, error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("Delete completed event error:", deleteError);

      if (deleteError.code === "23503") {
        return json(
          {
            error:
              "Event belum dapat dihapus karena masih memiliki data terkait. Data terkait perlu diperiksa terlebih dahulu.",
          },
          409
        );
      }

      return json({ error: "Gagal menghapus event." }, 500);
    }

    if (!deletedEvent) {
      return json({ error: "Event tidak ditemukan atau sudah dihapus." }, 404);
    }

    return json({
      success: true,
      message: "Event selesai berhasil dihapus.",
      id: deletedEvent.id,
    });
  } catch (error) {
    console.error("Delete completed event API error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
