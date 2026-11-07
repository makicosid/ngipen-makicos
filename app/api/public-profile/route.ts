import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

// Profil publik terbatas. Endpoint ini tidak pernah memilih atau mengirim username/bio.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("id")?.trim();

    if (!userId || userId.length > 100) {
      return json({ error: "ID profil tidak valid." }, 400);
    }

    const { data, error } = await getSupabaseAdmin()
      .from("users")
      .select("id, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Public profile lookup error:", error);
      return json({ error: "Gagal mengambil profil publik." }, 500);
    }

    if (!data) {
      return json({ error: "Profil tidak ditemukan." }, 404);
    }

    return json({
      success: true,
      profile: {
        id: data.id,
        display_name: data.display_name || "Pengguna",
        avatar_url: data.avatar_url || "",
      },
    });
  } catch (error) {
    console.error("Public profile API error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}
