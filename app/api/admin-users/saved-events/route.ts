import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  if (error) {
    console.error("Admin saved-events session check error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }

  return Boolean(data);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdminAuthenticated(request))) {
      return json(
        { error: "Sesi admin tidak valid. Silakan login kembali." },
        401
      );
    }

    const userId = request.nextUrl.searchParams.get("userId")?.trim() || "";

    if (!UUID_PATTERN.test(userId)) {
      return json({ error: "ID pengguna tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("event_saves")
      .select("id, created_at, event_id, events(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin saved-events query error:", error);
      return json(
        { error: "Gagal mengambil daftar event tersimpan pengguna." },
        500
      );
    }

    const savedEvents = (data || [])
      .filter((row) => row.events)
      .map((row) => ({
        savedAt: row.created_at,
        event: row.events,
      }));

    return json({
      success: true,
      userId,
      total: savedEvents.length,
      savedEvents,
    });
  } catch (error) {
    console.error("Admin saved-events API error:", error);
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
