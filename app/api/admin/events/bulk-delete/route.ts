import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BULK_DELETE = 500;

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
    console.error("Bulk delete admin session check error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }

  return Boolean(data);
}

type DeleteTarget = "Rejected";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Origin request tidak valid." }, 403);
    }

    const supabase = getSupabaseAdmin();
    const isAdmin = await hasValidAdminSession(request, supabase);

    if (!isAdmin) {
      return json(
        { error: "Sesi admin tidak valid atau sudah berakhir." },
        401
      );
    }

    let body: { ids?: unknown; target?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Format request tidak valid." }, 400);
    }

    if (body.target !== "Rejected") {
      return json(
        { error: "Bulk Delete hanya tersedia untuk event Rejected. Event Completed harus dihapus melalui Event Cleanup." },
        400
      );
    }

    if (
      !Array.isArray(body.ids) ||
      body.ids.length === 0 ||
      body.ids.length > MAX_BULK_DELETE ||
      body.ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))
    ) {
      return json(
        {
          error: `Daftar ID event tidak valid. Pilih 1 sampai ${MAX_BULK_DELETE} event.`,
        },
        400
      );
    }

    const target = body.target as DeleteTarget;
    const ids = Array.from(new Set(body.ids as string[]));

    const deletedIds: string[] = [];
    const blocked: { id: string; reason: string; dependencies?: {
      documentations: number;
      saves: number;
      views: number;
    } }[] = [];
    let skipped = 0;

    for (const eventId of ids) {
      const { data: event, error: fetchError } = await supabase
        .from("events")
        .select("id, moderation_status, start_date, end_date, end_time")
        .eq("id", eventId)
        .maybeSingle();

      if (fetchError) {
        console.error("Bulk delete event lookup error:", eventId, fetchError);
        blocked.push({
          id: eventId,
          reason: "Gagal memeriksa data event.",
        });
        continue;
      }

      if (!event) {
        skipped += 1;
        continue;
      }

      const eligible = event.moderation_status === "Rejected";

      if (!eligible) {
        skipped += 1;
        continue;
      }

      // Relasi database memakai ON DELETE CASCADE. Periksa semua tabel
      // terkait terlebih dahulu agar data anak tidak ikut terhapus.
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
          "Bulk delete dependency check error:",
          eventId,
          docs.error || saves.error || views.error
        );
        blocked.push({
          id: eventId,
          reason: "Gagal memeriksa data terkait. Event tidak dihapus.",
        });
        continue;
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
        blocked.push({
          id: eventId,
          reason: "Event masih memiliki data terkait.",
          dependencies,
        });
        continue;
      }

      const { data: deletedEvent, error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("id", eventId)
        .select("id")
        .maybeSingle();

      if (deleteError) {
        console.error("Bulk delete event error:", eventId, deleteError);
        blocked.push({
          id: eventId,
          reason:
            deleteError.code === "23503"
              ? "Event masih memiliki data terkait dan tidak dihapus."
              : "Terjadi kesalahan saat menghapus event.",
        });
        continue;
      }

      if (deletedEvent) {
        deletedIds.push(deletedEvent.id);
      } else {
        skipped += 1;
      }
    }

    return json({
      success: true,
      target,
      requested: ids.length,
      deleted: deletedIds.length,
      deletedIds,
      blocked,
      skipped,
      message: `${deletedIds.length} event berhasil dihapus.`,
    });
  } catch (error) {
    console.error("Bulk delete events API error:", error);
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
