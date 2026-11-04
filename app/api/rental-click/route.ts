
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Supabase server configuration is incomplete");
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Invalid request origin" }, 403);
    }

    const body = await request.json();

    const rentalId =
      typeof body.rental_id === "string"
        ? body.rental_id.trim()
        : "";

    const channel = body.channel;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(rentalId)) {
      return json({ error: "Invalid rental ID" }, 400);
    }

    if (channel !== "instagram" && channel !== "whatsapp") {
      return json({ error: "Invalid channel" }, 400);
    }

    const supabase = getSupabaseAdmin();

    const { data: rental, error: rentalError } = await supabase
      .from("costume_rentals")
      .select("id")
      .eq("id", rentalId)
      .maybeSingle();

    if (rentalError) {
      console.error("Rental lookup error:", rentalError);
      return json({ error: "Failed to verify rental" }, 500);
    }

    if (!rental) {
      return json({ error: "Rental not found" }, 404);
    }

    const { error: insertError } = await supabase
      .from("costume_rental_clicks")
      .insert({
        rental_id: rentalId,
        channel,
      });

    if (insertError) {
      console.error("Rental click insert error:", insertError);
      return json({ error: "Failed to record click" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Rental click API error:", error);
    return json({ error: "Internal server error" }, 500);
  }
}
