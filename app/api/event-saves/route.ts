
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_session";

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

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const { data, error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  return data;
}

// GET: Ambil daftar event tersimpan milik akun yang sedang login
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request);

    if (!session) {
      return json(
        { error: "Sesi login tidak valid. Silakan login kembali." },
        401
      );
    }

    const { data, error } = await getSupabaseAdmin()
      .from("event_saves")
      .select("event_id")
      .eq("user_id", session.user_id);

    if (error) {
      console.error("Fetch saved events error:", error);
      return json(
        { error: "Gagal mengambil daftar event tersimpan." },
        500
      );
    }

    return json({
      success: true,
      savedIds: (data || []).map((item) => item.event_id),
    });
  } catch (error) {
    console.error("Event saves GET error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}

// POST: Simpan atau hapus event
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const session = await getSession(request);

    if (!session) {
      return json(
        { error: "Sesi login tidak valid. Silakan login kembali." },
        401
      );
    }

    const body = await request.json();
    const action = body.action;
    const eventId =
      typeof body.eventId === "string" ? body.eventId.trim() : "";

    if (!eventId) {
      return json({ error: "ID event tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();

    if (action === "save") {
      const { error } = await supabase
        .from("event_saves")
        .upsert(
          {
            user_id: session.user_id,
            event_id: eventId,
          },
          {
            onConflict: "user_id,event_id",
            ignoreDuplicates: true,
          }
        );

      if (error) {
        console.error("Save event error:", error);
        return json({ error: "Gagal menyimpan event." }, 500);
      }

      return json({ success: true, saved: true });
    }

    if (action === "unsave") {
      const { error } = await supabase
        .from("event_saves")
        .delete()
        .eq("user_id", session.user_id)
        .eq("event_id", eventId);

      if (error) {
        console.error("Unsave event error:", error);
        return json({ error: "Gagal menghapus event tersimpan." }, 500);
      }

      return json({ success: true, saved: false });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("Event saves POST error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
