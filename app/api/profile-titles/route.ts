import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
const COOKIE_NAME = "ngipen_session";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
async function getUserSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return error || !data ? null : data;
}
async function getSelectedTitles(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("user_profile_titles")
    .select("profile_titles(title_key,title_name,title_type,style_variant,display_order)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data || [])
    .map((row: any) => row.profile_titles)
    .filter(Boolean)
    .sort((a: any, b: any) => Number(a.display_order) - Number(b.display_order));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getUserSession(request);
    if (!session) return json({ error: "Sesi login tidak valid." }, 401);
    const supabase = getSupabaseAdmin();
    const [{ data: availableTitles, error: titlesError }, selectedTitles] = await Promise.all([
      supabase.from("profile_titles")
        .select("title_key,title_name,title_type,style_variant,display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      getSelectedTitles(session.user_id),
    ]);
    if (titlesError) return json({ error: "Gagal memuat daftar title." }, 500);
    return json({
      success: true,
      availableTitles: (availableTitles || []).filter((title: any) => title.title_type === "regular"),
      selectedTitles,
    });
  } catch (error) {
    console.error("Profile titles GET error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }
    const session = await getUserSession(request);
    if (!session) return json({ error: "Sesi login tidak valid." }, 401);
    const body = await request.json();
    const titleKey = typeof body.titleKey === "string" ? body.titleKey.trim() : "";
    const action = body.action;
    if (!/^[a-z0-9_]{2,64}$/.test(titleKey) || !["equip", "unequip"].includes(action)) {
      return json({ error: "Permintaan title tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { data: title, error: titleError } = await supabase
      .from("profile_titles")
      .select("id,title_type,is_active")
      .eq("title_key", titleKey)
      .maybeSingle();
    if (titleError) return json({ error: "Gagal memeriksa title." }, 500);
    if (!title || !title.is_active) return json({ error: "Title tidak tersedia." }, 404);
    if (title.title_type !== "regular") {
      return json({ error: "Title eksklusif hanya dapat dikelola oleh Admin." }, 403);
    }

    const { error: changeError } = await supabase.rpc("user_manage_profile_title", {
      p_user_id: session.user_id,
      p_title_key: titleKey,
      p_action: action,
    });
    if (changeError) {
      if (changeError.message?.includes("PROFILE_TITLE_LIMIT_REACHED")) {
        return json({ error: "Kamu hanya bisa menggunakan maksimal 2 title reguler. Lepas salah satu title terlebih dahulu untuk memilih title lain." }, 409);
      }
      if (changeError.message?.includes("PROFILE_TITLE_NOT_AVAILABLE")) {
        return json({ error: "Title tidak tersedia." }, 404);
      }
      if (changeError.message?.includes("PROFILE_TITLE_NOT_REGULAR")) {
        return json({ error: "Title eksklusif hanya dapat dikelola oleh Admin." }, 403);
      }
      console.error("Profile title change RPC error:", changeError);
      return json({ error: "Gagal memperbarui title." }, 500);
    }

    return json({ success: true, selectedTitles: await getSelectedTitles(session.user_id) });
  } catch (error) {
    console.error("Profile titles POST error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}
