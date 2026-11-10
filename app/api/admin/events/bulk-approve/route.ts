import { readJsonObjectWithinLimit } from "../../../../../lib/request-body";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

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

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) {
      return json({ success: false, error: "Origin tidak diizinkan." }, 403);
    }

    const supabase = getSupabaseAdmin();
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) {
      return json({ success: false, error: "Sesi admin tidak valid. Silakan login kembali." }, 401);
    }

    const { data: session, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError) {
      console.error("Bulk approve session check error:", sessionError);
      return json({ success: false, error: "Gagal memeriksa sesi admin." }, 500);
    }
    if (!session) {
      return json({ success: false, error: "Sesi admin tidak valid atau telah berakhir." }, 401);
    }

    const parsedBody = await readJsonObjectWithinLimit(request, 128 * 1024);
    if (!parsedBody.ok) return json({ success: false, error: "Format JSON tidak valid atau terlalu besar." }, parsedBody.reason === "too_large" ? 413 : 400);
    const body = parsedBody.value as { ids?: unknown };

    if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 1000) {
      return json({ success: false, error: "Pilih antara 1 sampai 1000 event." }, 400);
    }

    const ids = Array.from(new Set(body.ids));
    if (ids.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) {
      return json({ success: false, error: "Terdapat ID event yang tidak valid." }, 400);
    }

    // Status diperiksa ulang di database. Hanya event yang masih Pending yang dapat berubah.
    // Kolom sponsor tidak disentuh sehingga persetujuan massal tidak mengaktifkan sponsor.
    const { data: updatedEvents, error: updateError } = await supabase
      .from("events")
      .update({ moderation_status: "Approved" })
      .in("id", ids as string[])
      .eq("moderation_status", "Pending")
      .select("id");

    if (updateError) {
      console.error("Bulk approve update error:", updateError);
      return json({ success: false, error: "Gagal memperbarui event di database." }, 500);
    }

    const updated = updatedEvents || [];
    return json({
      success: true,
      updatedEvents: updated,
      updated: updated.length,
      skipped: ids.length - updated.length,
    });
  } catch (error) {
    console.error("Bulk approve API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Terjadi kesalahan pada server.",
    }, 500);
  }
}
