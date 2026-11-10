import { readJsonObjectWithinLimit } from "../../../lib/request-body";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_session";

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

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return json({ counted: false, reason: "guest" }, 200);
    }

    const parsedBody = await readJsonObjectWithinLimit(request, 8 * 1024);
    if (!parsedBody.ok) return json({ error: "Format permintaan tidak valid atau terlalu besar." }, parsedBody.reason === "too_large" ? 413 : 400);
    const body = parsedBody.value;
    const eventId =
      typeof body?.eventId === "string" ? body.eventId : "";

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(eventId)) {
      return json({ error: "ID event tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();

    const { data: session, error: sessionError } = await supabase
      .from("ngipen_sessions")
      .select("user_id")
      .eq("token_hash", hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      return json({ counted: false, reason: "guest" }, 200);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError || !user) {
      return json({ counted: false, reason: "guest" }, 200);
    }

    const { data: counted, error: countError } = await supabase.rpc(
      "ngipen_record_event_view",
      {
        p_event_id: eventId,
        p_user_id: session.user_id,
      }
    );

    if (countError) {
      console.error("Event view error:", countError);
      return json({ error: "Gagal mencatat kunjungan event." }, 500);
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("views")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError || !event) {
      return json({ error: "Event tidak ditemukan." }, 404);
    }

    return json({
      counted: Boolean(counted),
      views: Number(event.views || 0),
    });
  } catch (error) {
    console.error("Event view API error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
