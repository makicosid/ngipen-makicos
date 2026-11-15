import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, isSameOrigin } from "../../../lib/server/advertising";

export const runtime = "nodejs";

function sessionHash(request: NextRequest) {
  const cookie = request.cookies.get("ngipen_ad_session")?.value;
  const token = cookie && /^[a-f0-9]{64}$/i.test(cookie) ? cookie : crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  return { hash: createHash("sha256").update(token).digest("hex"), token: cookie || token };
}

export async function GET(request: NextRequest) {
  try {
    const slot = request.nextUrl.searchParams.get("slot");
    if (!["banner", "floating", "popup"].includes(slot || "")) return NextResponse.json({ error: "Slot iklan tidak valid." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const [{ data: slotData, error: slotError }, { data: campaigns, error }] = await Promise.all([
      supabase.from("ad_slots").select("max_visible,is_enabled").eq("slot_code", slot).maybeSingle(),
      supabase.from("ad_campaigns").select("id,slot_code,campaign_name,image_path,target_url,starts_at,ends_at,sponsor:ad_sponsors(brand_name)").eq("slot_code", slot).in("status", ["active", "scheduled"]).lte("starts_at", now).gt("ends_at", now).limit(10),
    ]);
    if (slotError || error) return NextResponse.json({ error: "Gagal memuat iklan." }, { status: 500 });
    if (!slotData?.is_enabled) return NextResponse.json({ ads: [] }, { headers: { "Cache-Control": "no-store" } });

    const eligible = (campaigns ?? []).sort((a, b) => a.id.localeCompare(b.id));
    const limit = Math.max(1, Math.min(2, slotData.max_visible || 1));
    const selected = eligible.slice(0, limit);
    const ads = selected.map((campaign) => ({
      id: campaign.id,
      slot: campaign.slot_code,
      name: campaign.campaign_name,
      imageUrl: supabase.storage.from("ad-assets").getPublicUrl(campaign.image_path).data.publicUrl,
      targetUrl: campaign.target_url,
      sponsorName: Array.isArray(campaign.sponsor) ? campaign.sponsor[0]?.brand_name : campaign.sponsor?.brand_name,
    }));
    const response = NextResponse.json({ ads }, { headers: { "Cache-Control": "no-store" } });
    const session = sessionHash(request);
    if (!request.cookies.get("ngipen_ad_session")?.value) response.cookies.set("ngipen_ad_session", session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 31536000 });
    return response;
  } catch (error) {
    console.error("Public advertising GET failed:", error);
    return NextResponse.json({ error: "Gagal memuat iklan." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Permintaan tidak diizinkan." }, { status: 403 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Data tracking tidak valid." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const campaignId = typeof input.campaignId === "string" ? input.campaignId : "";
    const eventType = input.eventType;
    const eventKey = typeof input.eventKey === "string" ? input.eventKey : "";
    const pagePath = typeof input.pagePath === "string" ? input.pagePath.slice(0, 300) : null;
    if (!campaignId || !["impression", "click"].includes(String(eventType)) || !/^[0-9a-f-]{36}$/i.test(eventKey)) return NextResponse.json({ error: "Data tracking tidak valid." }, { status: 400 });
    const session = sessionHash(request);
    const supabase = getSupabaseAdmin();
    const { data: campaign, error: campaignError } = await supabase.from("ad_campaigns").select("id,status,starts_at,ends_at").eq("id", campaignId).maybeSingle();
    const now = Date.now();
    if (campaignError || !campaign || !["active", "scheduled"].includes(campaign.status) || new Date(campaign.starts_at).getTime() > now || new Date(campaign.ends_at).getTime() <= now) return NextResponse.json({ error: "Kampanye tidak aktif." }, { status: 404 });
    const { error } = await supabase.from("ad_events").insert({ campaign_id: campaignId, event_type: eventType, session_hash: session.hash, event_key: eventKey, page_path: pagePath });
    if (error && error.code !== "23505") return NextResponse.json({ error: "Gagal mencatat interaksi iklan." }, { status: 500 });
    const response = NextResponse.json({ success: true });
    if (!request.cookies.get("ngipen_ad_session")?.value) response.cookies.set("ngipen_ad_session", session.token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 31536000 });
    return response;
  } catch (error) {
    console.error("Public advertising tracking failed:", error);
    return NextResponse.json({ error: "Gagal mencatat interaksi iklan." }, { status: 500 });
  }
}
