import { readJsonObjectWithinLimit } from "../../../../../lib/request-body";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";

const ALLOWED_STATUSES = [
  "Pending",
  "Approved",
  "Rejected",
  "Hidden",
] as const;

type ModerationStatus = (typeof ALLOWED_STATUSES)[number];

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
    console.error("Admin moderation session error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }

  return Boolean(data);
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validasi Origin untuk mencegah request dari situs lain.
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json(
        { success: false, error: "Origin tidak diizinkan." },
        403
      );
    }

    // 2. Buat koneksi Supabase server.
    const supabase = getSupabaseAdmin();

    // 3. Validasi sesi admin.
    const isAdmin = await hasValidAdminSession(request, supabase);

    if (!isAdmin) {
      return json(
        { success: false, error: "Sesi admin tidak valid atau telah berakhir." },
        401
      );
    }

    // 4. Baca dan validasi data request.
    let body: {
      id?: unknown;
      status?: unknown;
      sponsor?: unknown;
      priority?: unknown;
    };

    const parsedBody = await readJsonObjectWithinLimit(request, 16 * 1024);
    if (!parsedBody.ok) return json({ success: false, error: "Format JSON tidak valid atau terlalu besar." }, parsedBody.reason === "too_large" ? 413 : 400);
    body = parsedBody.value as typeof body;

    const { id, status, sponsor, priority } = body;

    if (
      typeof id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ) {
      return json(
        { success: false, error: "ID event tidak valid." },
        400
      );
    }

    if (
      typeof status !== "string" ||
      !ALLOWED_STATUSES.includes(status as ModerationStatus)
    ) {
      return json(
        { success: false, error: "Status moderasi tidak valid." },
        400
      );
    }

    if (sponsor !== undefined && typeof sponsor !== "boolean") {
      return json(
        { success: false, error: "Pengaturan sponsor tidak valid." },
        400
      );
    }

    if (
      priority !== undefined &&
      (
        typeof priority !== "number" ||
        !Number.isInteger(priority) ||
        priority < 0 ||
        priority > 1000
      )
    ) {
      return json(
        { success: false, error: "Prioritas sponsor tidak valid." },
        400
      );
    }

    const moderationStatus = status as ModerationStatus;

    // 5. Susun data yang akan diperbarui.
    const updateData: Record<string, unknown> = {
      moderation_status: moderationStatus,
    };

    // Event yang bukan Approved tidak boleh tetap menjadi sponsor.
    if (moderationStatus !== "Approved") {
      updateData.is_sponsored = false;
      updateData.sponsored_priority = 0;
      updateData.sponsored_start = null;
      updateData.sponsored_end = null;
    } else if (sponsor === true) {
      // Sponsor hanya dapat diaktifkan untuk event Approved.
      const startDate = new Date();
      const endDate = new Date(
        startDate.getTime() + 30 * 24 * 60 * 60 * 1000
      );

      updateData.is_sponsored = true;
      updateData.sponsored_priority = priority ?? 1;
      updateData.sponsored_start = startDate.toISOString();
      updateData.sponsored_end = endDate.toISOString();
    } else if (sponsor === false) {
      // Menonaktifkan sponsor.
      updateData.is_sponsored = false;
      updateData.sponsored_priority = 0;
      updateData.sponsored_start = null;
      updateData.sponsored_end = null;
    }

    // 6. Perbarui event melalui service role di server.
    const { data: updatedEvent, error } = await supabase
      .from("events")
      .update(updateData)
      .eq("id", id)
      .select("id, moderation_status, is_sponsored, sponsored_priority, sponsored_start, sponsored_end")
      .maybeSingle();

    if (error) {
      console.error("Event moderation update error:", error);

      return json(
        {
          success: false,
          error: "Gagal memperbarui event di database.",
        },
        500
      );
    }

    if (!updatedEvent) {
      return json(
        { success: false, error: "Event tidak ditemukan." },
        404
      );
    }

    // 7. Kirim hasil yang sesuai dengan page.tsx.
    return json({
      success: true,
      update: updatedEvent,
      message: "Moderasi event berhasil diperbarui.",
    });
  } catch (error) {
    console.error("Admin moderation API error:", error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan pada server.",
      },
      500
    );
  }
}
