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

    const campaignIds = (campaigns ?? []).map(campaign => campaign.id);
    const { data: creativeRows, error: creativeError } = campaignIds.length
      ? await supabase.from("ad_creatives").select("id,campaign_id,image_path,target_url,sort_order,is_active,created_at,updated_at").in("campaign_id", campaignIds).order("sort_order", { ascending: true })
      : { data: [], error: null };
    type AdCreativeRow = {
      id: string;
      campaign_id: string;
      image_path: string;
      target_url: string;
      sort_order: number;
      is_active: boolean;
      created_at: string;
      updated_at: string;
    };
    const creativesByCampaign = new Map<string, AdCreativeRow[]>();
    if (!creativeError) for (const creative of (creativeRows ?? []) as AdCreativeRow[]) {
      const current = creativesByCampaign.get(creative.campaign_id) ?? [];
      current.push(creative);
      creativesByCampaign.set(creative.campaign_id, current);
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
        creatives: creativesByCampaign.get(campaign.id) ?? [],
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

      const [{ data: sponsor, error: sponsorError }, { data: slot, error: slotError }] = await Promise.all([
        supabase.from("ad_sponsors").select("id").eq("id", sponsorId).eq("status", "active").maybeSingle(),
        supabase.from("ad_slots").select("slot_code,is_enabled").eq("slot_code", slotCode).maybeSingle(),
      ]);
      if (sponsorError || !sponsor) return adminJson({ error: "Sponsor tidak ditemukan atau tidak aktif." }, 400);
      if (slotError || !slot?.is_enabled) return adminJson({ error: "Slot iklan tidak ditemukan atau sedang dinonaktifkan." }, 400);
      const { data: overlapping, error: overlapError } = await supabase.from("ad_campaigns")
        .select("sponsor_id").eq("slot_code", slotCode).in("status", ["active", "scheduled"])
        .lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());
      if (overlapError) return adminJson({ error: "Gagal memeriksa kapasitas slot." }, 500);
      const activeBrands = new Set((overlapping ?? []).map(row => row.sponsor_id));
      if (activeBrands.has(sponsorId)) return adminJson({ error: "Brand ini sudah memiliki kampanye pada slot dan periode yang bertabrakan." }, 409);
      if (activeBrands.size >= 3) return adminJson({ error: "Slot ini sudah mencapai batas 3 brand pada periode tersebut." }, 409);

      const { data, error } = await supabase.from("ad_campaigns").insert({
        sponsor_id: sponsorId, slot_code: slotCode, campaign_name: campaignName, image_path: imagePath,
        target_url: targetUrl, status: "scheduled", starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        created_by: "admin", updated_by: "admin",
      }).select("id,sponsor_id,slot_code,campaign_name,image_path,target_url,status,starts_at,ends_at,created_at").single();
      if (error || !data) return adminJson({ error: "Gagal menyimpan kampanye. Periksa kembali data dan slot." }, 500);
      const { error: creativeInsertError } = await supabase.from("ad_creatives").insert({
        campaign_id: data.id, image_path: imagePath, target_url: targetUrl, sort_order: 0, is_active: true,
      });
      if (creativeInsertError && creativeInsertError.code !== "42P01" && creativeInsertError.code !== "PGRST205") {
        await supabase.from("ad_campaigns").delete().eq("id", data.id);
        return adminJson({ error: "Materi poster gagal disimpan." }, 500);
      }
      await writeAudit(supabase, "campaign_created", data.id, { slot_code: slotCode, campaign_name: campaignName });
      return adminJson({ success: true, campaign: data }, 201);
    }

    return adminJson({ error: "Aksi tidak dikenal." }, 400);
  } catch (error) {
    console.error("Advertising POST failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat menyimpan data." }, 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return adminJson({ error: "Permintaan tidak diizinkan." }, 403);
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return adminJson({ error: "Format data tidak valid." }, 400);
    const deleteInput = body as Record<string, unknown>;
    if (deleteInput.action === "delete_brand") {
      const sponsorId = typeof deleteInput.id === "string" ? deleteInput.id : "";
      if (!sponsorId) return adminJson({ error: "Brand tidak valid." }, 400);

      const { data: sponsor, error: sponsorError } = await supabase
        .from("ad_sponsors")
        .select("id,brand_name")
        .eq("id", sponsorId)
        .maybeSingle();
      if (sponsorError || !sponsor) return adminJson({ error: "Brand tidak ditemukan." }, 404);

      const { data: brandCampaigns, error: campaignsError } = await supabase
        .from("ad_campaigns")
        .select("id,campaign_name,image_path")
        .eq("sponsor_id", sponsorId);
      if (campaignsError) return adminJson({ error: "Gagal membaca campaign milik brand." }, 500);

      const campaignIds = (brandCampaigns ?? []).map(item => item.id);
      const { data: creativeRows, error: creativesError } = campaignIds.length
        ? await supabase.from("ad_creatives").select("image_path").in("campaign_id", campaignIds)
        : { data: [], error: null };
      if (creativesError && creativesError.code !== "42P01" && creativesError.code !== "PGRST205") {
        return adminJson({ error: "Gagal membaca poster milik brand." }, 500);
      }

      const imagePaths = Array.from(new Set([
        ...(brandCampaigns ?? []).map(item => item.image_path),
        ...((creativeRows ?? []) as Array<{ image_path: string }>).map(item => item.image_path),
      ])).filter(path => typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.includes(".."));

      // SQL migration changes sponsor/campaign and campaign/event foreign keys to CASCADE.
      // Audit rows remain available because ad_audit_logs.campaign_id uses ON DELETE SET NULL.
      const { data: deletedSponsor, error: deleteBrandError } = await supabase
        .from("ad_sponsors")
        .delete()
        .eq("id", sponsorId)
        .select("id")
        .maybeSingle();
      if (deleteBrandError || !deletedSponsor) {
        console.error("Advertising brand delete failed:", deleteBrandError?.code);
        return adminJson({ error: "Brand belum dapat dihapus. Pastikan SQL penghapusan brand sudah dijalankan." }, 500);
      }

      await writeAudit(supabase, "brand_deleted", null, {
        sponsor_id: sponsor.id,
        brand_name: sponsor.brand_name,
        deleted_campaign_count: campaignIds.length,
        deleted_campaigns: (brandCampaigns ?? []).map(item => ({ id: item.id, name: item.campaign_name })),
      });

      if (imagePaths.length) {
        const { error: storageError } = await supabase.storage.from("ad-assets").remove(imagePaths);
        if (storageError) console.error("Advertising brand asset cleanup failed:", storageError.message);
      }

      return adminJson({ success: true, deletedCampaigns: campaignIds.length });
    }

    const id = typeof deleteInput.id === "string" ? deleteInput.id : "";
    if (!id) return adminJson({ error: "Kampanye tidak valid." }, 400);

    const { data: campaign, error: campaignError } = await supabase
      .from("ad_campaigns")
      .select("id,campaign_name,image_path,status,ends_at")
      .eq("id", id)
      .maybeSingle();
    if (campaignError || !campaign) return adminJson({ error: "Kampanye tidak ditemukan." }, 404);

    const { data: campaignCreatives } = await supabase.from("ad_creatives").select("id,image_path").eq("campaign_id", id);
    const hasEnded = new Date(campaign.ends_at).getTime() <= Date.now();
    if (campaign.status !== "completed" && !hasEnded) {
      return adminJson({ error: "Hanya kampanye yang sudah selesai yang dapat dihapus." }, 400);
    }

    const [{ count: impressions }, { count: clicks }] = await Promise.all([
      supabase.from("ad_events").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("event_type", "impression"),
      supabase.from("ad_events").select("id", { count: "exact", head: true }).eq("campaign_id", id).eq("event_type", "click"),
    ]);

    // Keep an audit trail while detaching the campaign foreign key before deleting it.
    const { error: detachAuditError } = await supabase
      .from("ad_audit_logs")
      .update({ campaign_id: null })
      .eq("campaign_id", id);
    if (detachAuditError) {
      console.error("Advertising audit detach failed:", detachAuditError.code);
      return adminJson({ error: "Riwayat audit kampanye tidak dapat diamankan; kampanye tidak dihapus." }, 500);
    }

    const { error: eventsError } = await supabase.from("ad_events").delete().eq("campaign_id", id);
    if (eventsError) {
      console.error("Advertising events delete failed:", eventsError.code);
      return adminJson({ error: "Gagal menghapus statistik kampanye." }, 500);
    }

    const { error: deleteError } = await supabase.from("ad_campaigns").delete().eq("id", id);
    if (deleteError) {
      console.error("Advertising campaign delete failed:", deleteError.code);
      return adminJson({ error: "Gagal menghapus kampanye." }, 500);
    }

    await writeAudit(supabase, "campaign_deleted", null, {
      campaign_id: id,
      campaign_name: campaign.campaign_name,
      impressions: impressions ?? 0,
      clicks: clicks ?? 0,
    });

    const imagePaths = Array.from(new Set([
      typeof campaign.image_path === "string" ? campaign.image_path : "",
      ...(campaignCreatives ?? []).map(item => item.image_path),
    ])).filter(path => path && !path.startsWith("/") && !path.includes(".."));
    if (imagePaths.length) {
      const { error: storageError } = await supabase.storage.from("ad-assets").remove(imagePaths);
      if (storageError) console.error("Advertising image cleanup failed:", storageError.message);
    }

    return adminJson({ success: true });
  } catch (error) {
    console.error("Advertising DELETE failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat menghapus kampanye." }, 500);
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

    if (input.action === "edit_campaign") {
      const campaignName = typeof input.campaignName === "string" ? input.campaignName.trim() : "";
      const startsAt = typeof input.startsAt === "string" ? new Date(input.startsAt) : null;
      const endsAt = typeof input.endsAt === "string" ? new Date(input.endsAt) : null;
      const creatives = Array.isArray(input.creatives) ? input.creatives as Array<Record<string, unknown>> : [];
      if (!id || campaignName.length < 2 || campaignName.length > 150) return adminJson({ error: "Nama kampanye tidak valid." }, 400);
      if (!startsAt || !endsAt || !Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) return adminJson({ error: "Periode kampanye tidak valid." }, 400);
      if (creatives.length < 1 || creatives.length > 20) return adminJson({ error: "Kampanye harus memiliki 1–20 poster." }, 400);
      const normalized = creatives.map((creative, index) => ({
        image_path: typeof creative.imagePath === "string" ? creative.imagePath.trim() : "",
        target_url: safeHttpsUrl(creative.targetUrl),
        sort_order: index,
        is_active: creative.isActive !== false,
      }));
      if (normalized.some(item => !item.image_path || item.image_path.length > 500 || item.image_path.startsWith("/") || item.image_path.includes("..") || !item.target_url)) return adminJson({ error: "Poster dan URL HTTPS wajib valid." }, 400);
      const { data: existing, error: existingError } = await supabase.from("ad_campaigns").select("id,sponsor_id,slot_code,image_path").eq("id", id).maybeSingle();
      if (existingError || !existing) return adminJson({ error: "Kampanye tidak ditemukan." }, 404);
      const { data: oldCreatives, error: oldError } = await supabase.from("ad_creatives").select("id,image_path").eq("campaign_id", id);
      if (oldError && oldError.code !== "42P01" && oldError.code !== "PGRST205") return adminJson({ error: "Gagal membaca poster lama." }, 500);
      if (oldError && creatives.length > 1) return adminJson({ error: "Jalankan SQL migrasi materi iklan terlebih dahulu untuk menggunakan banyak poster." }, 409);
      const { data: overlapping, error: overlapError } = await supabase.from("ad_campaigns").select("sponsor_id")
        .eq("slot_code", existing.slot_code).neq("id", id).in("status", ["active", "scheduled"])
        .lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());
      if (overlapError) return adminJson({ error: "Gagal memeriksa kapasitas slot." }, 500);
      const brands = new Set((overlapping ?? []).map(row => row.sponsor_id));
      brands.add(existing.sponsor_id);
      if (brands.size > 3) return adminJson({ error: "Periode ini akan melebihi batas 3 brand." }, 409);

      const primary = normalized[0];
      const { error: updateError } = await supabase.from("ad_campaigns").update({
        campaign_name: campaignName, image_path: primary.image_path, target_url: primary.target_url as string,
        starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(),
        updated_at: new Date().toISOString(), updated_by: "admin",
      }).eq("id", id);
      if (updateError) return adminJson({ error: "Gagal memperbarui kampanye." }, 500);

      if (!oldError) {
        const { error: insertError } = await supabase.from("ad_creatives").insert(normalized.map(item => ({ campaign_id: id, image_path: item.image_path, target_url: item.target_url as string, sort_order: item.sort_order, is_active: item.is_active })));
        if (insertError) return adminJson({ error: "Gagal menyimpan poster baru; materi lama tetap dipertahankan." }, 500);
        const oldCreativeIds = (oldCreatives ?? []).map(item => item.id);
        const { error: deleteError } = oldCreativeIds.length
          ? await supabase.from("ad_creatives").delete().in("id", oldCreativeIds)
          : { error: null };
        if (deleteError) return adminJson({ error: "Materi baru tersimpan, tetapi pembersihan materi lama gagal." }, 500);
      }
      await writeAudit(supabase, "campaign_edited", id, { campaign_name: campaignName, creative_count: normalized.length });
      const oldPaths = (oldCreatives ?? []).map(item => item.image_path).filter(path => !normalized.some(item => item.image_path === path));
      if (oldPaths.length) {
        const { error: cleanupError } = await supabase.storage.from("ad-assets").remove(oldPaths);
        if (cleanupError) console.error("Advertising old poster cleanup failed:", cleanupError.message);
      }
      return adminJson({ success: true });
    }

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
