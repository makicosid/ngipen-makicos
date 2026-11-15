import { NextRequest } from "next/server";
import { adminJson, getSupabaseAdmin, isAdSlot, isSameOrigin, requireAdmin, safeHttpsUrl } from "../../../../lib/server/advertising";

export const runtime = "nodejs";

async function writeAudit(supabase: ReturnType<typeof getSupabaseAdmin>, action: string, campaignId: string | null, details: Record<string, unknown>) {
  const { error } = await supabase.from("ad_audit_logs").insert({
    campaign_id: campaignId,
    admin_actor: "admin",
    action,
    details,
  });
  if (error) console.error("Advertising audit log failed:", error.code);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    const [{ data: sponsors, error: sponsorError }, { data: campaigns, error: campaignError }, { data: slots, error: slotError }, { data: events, error: eventError }] = await Promise.all([
      supabase.from("ad_sponsors").select("id,brand_name,contact_name,contact_email,notes,status,created_at,updated_at").order("created_at", { ascending: false }),
      supabase.from("ad_campaigns").select("id,sponsor_id,slot_code,campaign_name,image_path,target_url,status,starts_at,ends_at,created_at,updated_at,ad_sponsors(brand_name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("ad_slots").select("slot_code,display_name,max_visible,is_enabled").order("slot_code"),
      supabase.from("ad_events").select("campaign_id,event_type,created_at").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);
    if (sponsorError || campaignError || slotError || eventError) {
      console.error("Advertising dashboard query failed:", sponsorError?.code, campaignError?.code, slotError?.code, eventError?.code);
      return adminJson({ error: "Gagal memuat data Advertising Partner." }, 500);
    }

    const metrics = new Map<string, { impressions: number; clicks: number }>();
    for (const event of events ?? []) {
      const current = metrics.get(event.campaign_id) ?? { impressions: 0, clicks: 0 };
      if (event.event_type === "impression") current.impressions++;
      if (event.event_type === "click") current.clicks++;
      metrics.set(event.campaign_id, current);
    }
    return adminJson({
      sponsors: sponsors ?? [],
      slots: slots ?? [],
      campaigns: (campaigns ?? []).map((campaign) => ({
        ...campaign,
        metrics: metrics.get(campaign.id) ?? { impressions: 0, clicks: 0 },
      })),
    });
  } catch (error) {
    console.error("Advertising dashboard GET failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat memuat Advertising Partner." }, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return adminJson({ error: "Permintaan tidak diizinkan." }, 403);
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return adminJson({ error: "Format data tidak valid." }, 400);
    const input = body as Record<string, unknown>;

    if (input.action === "create_sponsor") {
      const brandName = typeof input.brandName === "string" ? input.brandName.trim() : "";
      const contactName = typeof input.contactName === "string" ? input.contactName.trim() : null;
      const contactEmail = typeof input.contactEmail === "string" ? input.contactEmail.trim() : null;
      const notes = typeof input.notes === "string" ? input.notes.trim() : null;
      if (brandName.length < 2 || brandName.length > 120) return adminJson({ error: "Nama brand wajib 2–120 karakter." }, 400);
      if (contactEmail && (contactEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))) return adminJson({ error: "Format email kontak tidak valid." }, 400);
      const { data, error } = await supabase.from("ad_sponsors").insert({ brand_name: brandName, contact_name: contactName, contact_email: contactEmail, notes, status: "active" }).select("id,brand_name,contact_name,contact_email,notes,status,created_at").single();
      if (error || !data) return adminJson({ error: "Gagal menyimpan sponsor." }, 500);
      await writeAudit(supabase, "sponsor_created", null, { sponsor_id: data.id, brand_name: brandName });
      return adminJson({ success: true, sponsor: data }, 201);
    }

    if (input.action === "create_campaign") {
      const sponsorId = typeof input.sponsorId === "string" ? input.sponsorId : "";
      const slotCode = input.slotCode;
      const campaignName = typeof input.campaignName === "string" ? input.campaignName.trim() : "";
      const imagePath = typeof input.imagePath === "string" ? input.imagePath.trim() : "";
      const targetUrl = safeHttpsUrl(input.targetUrl);
      const startsAt = typeof input.startsAt === "string" ? new Date(input.startsAt) : null;
      const endsAt = typeof input.endsAt === "string" ? new Date(input.endsAt) : null;
      if (!sponsorId || !isAdSlot(slotCode)) return adminJson({ error: "Sponsor dan slot iklan wajib dipilih." }, 400);
      if (campaignName.length < 2 || campaignName.length > 150) return adminJson({ error: "Nama kampanye wajib 2–150 karakter." }, 400);
      if (!imagePath || imagePath.length > 500 || imagePath.startsWith("/") || imagePath.includes("..")) return adminJson({ error: "Path gambar tidak valid." }, 400);
      if (!targetUrl) return adminJson({ error: "URL tujuan wajib menggunakan HTTPS." }, 400);
      if (!startsAt || !endsAt || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return adminJson({ error: "Periode kampanye tidak valid." }, 400);

      const { data: sponsor, error: sponsorError } = await supabase.from("ad_sponsors").select("id").eq("id", sponsorId).eq("status", "active").maybeSingle();
      if (sponsorError || !sponsor) return adminJson({ error: "Sponsor tidak ditemukan atau tidak aktif." }, 400);
      const { data, error } = await supabase.from("ad_campaigns").insert({
        sponsor_id: sponsorId, slot_code: slotCode, campaign_name: campaignName, image_path: imagePath,
        target_url: targetUrl, status: "scheduled", starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        created_by: "admin", updated_by: "admin",
      }).select("id,sponsor_id,slot_code,campaign_name,image_path,target_url,status,starts_at,ends_at,created_at").single();
      if (error || !data) return adminJson({ error: "Gagal menyimpan kampanye. Periksa kembali data dan slot." }, 500);
      await writeAudit(supabase, "campaign_created", data.id, { slot_code: slotCode, campaign_name: campaignName });
      return adminJson({ success: true, campaign: data }, 201);
    }

    return adminJson({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("Advertising POST failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat menyimpan data." }, 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return adminJson({ error: "Permintaan tidak diizinkan." }, 403);
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return adminJson({ error: "Format data tidak valid." }, 400);
    const input = body as Record<string, unknown>;
    const id = typeof input.id === "string" ? input.id : "";
    const status = input.status;
    if (!id || !["draft", "scheduled", "active", "paused", "completed"].includes(String(status))) return adminJson({ error: "Kampanye atau status tidak valid." }, 400);
    const { data, error } = await supabase.from("ad_campaigns").update({ status, updated_at: new Date().toISOString(), updated_by: "admin" }).eq("id", id).select("id,status").maybeSingle();
    if (error || !data) return adminJson({ error: "Gagal memperbarui status kampanye." }, 500);
    await writeAudit(supabase, "campaign_status_changed", id, { status });
    return adminJson({ success: true, campaign: data });
  } catch (error) {
    console.error("Advertising PATCH failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat memperbarui kampanye." }, 500);
  }
}
