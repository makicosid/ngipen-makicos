import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

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

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function safeSocialUrl(value: string | null, platform: "instagram" | "tiktok") {
  if (!value) return "";
  try {
    const url = new URL(value);
    const hosts = platform === "instagram"
      ? ["instagram.com", "www.instagram.com"]
      : ["tiktok.com", "www.tiktok.com"];
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !hosts.includes(url.hostname.toLowerCase()) ||
      url.pathname.replace(/\/+$/, "").length < 2
    ) return "";
    return url.toString();
  } catch {
    return "";
  }
}

async function hasAuthenticatedSession(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const userToken = request.cookies.get("ngipen_session")?.value;
  if (userToken) {
    const { data, error } = await supabase
      .from("ngipen_sessions")
      .select("user_id")
      .eq("token_hash", hashToken(userToken))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!error && data) return true;
  }

  const adminToken = request.cookies.get("ngipen_admin_session")?.value;
  if (adminToken) {
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", hashToken(adminToken))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!error && data) return true;
  }

  return false;
}

// Profil kartu hanya tersedia untuk sesi User atau Admin yang valid.
export async function GET(request: NextRequest) {
  try {
    if (!(await hasAuthenticatedSession(request))) {
      return json({ error: "Silakan login untuk melihat profil." }, 401);
    }

    const userId = request.nextUrl.searchParams.get("id")?.trim();

    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "ID profil tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("users")
      .select("id, display_name, avatar_url, selected_frame_key, is_makicos_member, bio, instagram_url, tiktok_url")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Public profile lookup error:", error);
      return json({ error: "Gagal mengambil profil publik." }, 500);
    }

    if (!data) {
      return json({ error: "Profil tidak ditemukan." }, 404);
    }

    const { data: titleRows, error: titleError } = await supabase
      .from("user_profile_titles")
      .select("profile_titles(title_key,title_name,title_type,style_variant,display_order)")
      .eq("user_id", userId);
    if (titleError) return json({ error: "Gagal mengambil title profil." }, 500);
    const profileTitles = (titleRows || []).map((row: any) => row.profile_titles).filter(Boolean)
      .sort((a: any, b: any) => Number(a.display_order) - Number(b.display_order));

    return json({
      success: true,
      profile: {
        id: data.id,
        profile_titles: profileTitles,
        display_name: data.display_name || "Pengguna",
        avatar_url: data.avatar_url || "",
        selected_frame_key: data.selected_frame_key || "free_red",
        is_makicos_member: Boolean(data.is_makicos_member),
        bio: data.bio || "",
        instagram_url: safeSocialUrl(data.instagram_url, "instagram"),
        tiktok_url: safeSocialUrl(data.tiktok_url, "tiktok"),
      },
    });
  } catch (error) {
    console.error("Public profile API error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}
