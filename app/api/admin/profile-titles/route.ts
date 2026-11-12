import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
const ADMIN_COOKIE_NAME = "ngipen_admin_session";

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
async function isAdminAuthenticated(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  const { data, error } = await getSupabaseAdmin()
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return !error && Boolean(data);
}

export async function PATCH(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }
    if (!(await isAdminAuthenticated(request))) {
      return json({ error: "Sesi admin tidak valid." }, 401);
    }
    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const action = body.action;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : null;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      return json({ error: "ID pengguna tidak valid." }, 400);
    }
    if (!["grant", "revoke"].includes(action)) return json({ error: "Aksi title tidak valid." }, 400);

    const supabase = getSupabaseAdmin();
    const [{ data: user, error: userError }, { data: title, error: titleError }, { data: admin }] = await Promise.all([
      supabase.from("users").select("id").eq("id", userId).maybeSingle(),
      supabase.from("profile_titles").select("id,title_key,title_type,is_active").eq("title_key", "top_supporter").maybeSingle(),
      supabase.from("admin_settings").select("username").limit(1).maybeSingle(),
    ]);
    if (userError || titleError) return json({ error: "Gagal memeriksa data title." }, 500);
    if (!user) return json({ error: "Pengguna tidak ditemukan." }, 404);
    if (!title || title.title_type !== "exclusive" || !title.is_active) {
      return json({ error: "Konfigurasi Top Supporter tidak tersedia." }, 500);
    }

    if (action === "grant") {
      const { error } = await supabase.from("user_profile_titles").upsert(
        { user_id: userId, title_id: title.id, granted_by: admin?.username || "admin", granted_at: new Date().toISOString() },
        { onConflict: "user_id,title_id", ignoreDuplicates: true }
      );
      if (error) return json({ error: "Gagal memberikan Top Supporter." }, 500);
    } else {
      const { error } = await supabase.from("user_profile_titles")
        .delete()
        .eq("user_id", userId)
        .eq("title_id", title.id);
      if (error) return json({ error: "Gagal mencabut Top Supporter." }, 500);
    }

    const { error: auditError } = await supabase.from("profile_title_audit_logs").insert({
      actor_label: admin?.username || "admin",
      target_user_id: userId,
      title_id: title.id,
      action: action === "grant" ? "granted" : "revoked",
      reason,
    });
    if (auditError) {
      console.error("Profile title audit insert failed:", auditError);
      return json({ error: "Perubahan title tersimpan, tetapi audit log gagal dicatat." }, 500);
    }
    return json({ success: true, action, titleKey: "top_supporter" });
  } catch (error) {
    console.error("Admin profile title error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}
