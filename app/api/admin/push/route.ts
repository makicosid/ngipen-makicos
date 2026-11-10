import { NextRequest } from "next/server";
import { adminJson, isSameOrigin, requireAdmin } from "../../../../lib/server/admin-push";

export const runtime = "nodejs";

const TITLE_MAX = 120;
const BODY_MAX = 500;

export async function GET(request: NextRequest) {
  try {
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    const [{ count, error: countError }, { data: campaigns, error: campaignError }] = await Promise.all([
      supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
      supabase
        .from("push_campaigns")
        .select("id,title,body,target_url,status,total_targets,total_sent,total_failed,created_by,created_at,send_started_at,completed_at")
        .order("created_at", { ascending: false })
        .limit(25),
    ]);

    if (countError || campaignError) {
      console.error("Admin push dashboard query failed:", countError?.code, campaignError?.code);
      return adminJson({ error: "Gagal memuat data kampanye notifikasi." }, 500);
    }

    return adminJson({
      activeDevices: count ?? 0,
      campaigns: campaigns ?? [],
      sendingEnabled: process.env.PUSH_CAMPAIGNS_SEND_ENABLED === "true",
    });
  } catch (error) {
    console.error("Admin push GET failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat memuat kampanye." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return adminJson({ error: "Permintaan tidak diizinkan." }, 403);

    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 8 * 1024) return adminJson({ error: "Data terlalu besar." }, 413);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return adminJson({ error: "Format data tidak valid." }, 400);
    }

    const input = body as Record<string, unknown>;
    const title = typeof input.title === "string" ? input.title.trim() : "";
    const message = typeof input.body === "string" ? input.body.trim() : "";
    const targetUrl = typeof input.targetUrl === "string" ? input.targetUrl.trim() : "/";

    if (!title || title.length > TITLE_MAX) {
      return adminJson({ error: "Judul wajib diisi dan maksimal 120 karakter." }, 400);
    }
    if (!message || message.length > BODY_MAX) {
      return adminJson({ error: "Isi notifikasi wajib diisi dan maksimal 500 karakter." }, 400);
    }
    if (
      targetUrl.length > 500 ||
      !targetUrl.startsWith("/") ||
      targetUrl.startsWith("//") ||
      targetUrl.includes("\\")
    ) {
      return adminJson({ error: "URL tujuan harus berupa path internal NGIPEN." }, 400);
    }

    const { data, error } = await supabase
      .from("push_campaigns")
      .insert({
        title,
        body: message,
        target_url: targetUrl,
        status: "draft",
        created_by: "admin",
      })
      .select("id,title,body,target_url,status,total_targets,total_sent,total_failed,created_at")
      .single();

    if (error || !data) {
      console.error("Push campaign draft creation failed:", error?.code);
      return adminJson({ error: "Gagal menyimpan draft notifikasi." }, 500);
    }

    return adminJson({ success: true, campaign: data }, 201);
  } catch (error) {
    console.error("Admin push POST failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat membuat draft." }, 500);
  }
}
