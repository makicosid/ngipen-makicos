import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/server/advertising";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOT_CODES = ["banner", "floating", "popup"] as const;
const SLOT_LABELS: Record<string, string> = { banner: "Banner", floating: "Floating", popup: "Pop Up" };
const TIME_ZONE = "Asia/Jakarta";
const DAY_MS = 86400000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")) };
}

function dateKeyFromUtcDay(value: number) {
  const date = new Date(value);
  return date.toISOString().slice(0, 10);
}

function jakartaMidnightIso(dateKey: string) {
  return new Date(Date.parse(dateKey + "T00:00:00.000Z") - WIB_OFFSET_MS).toISOString();
}

function addDays(dateKey: string, days: number) {
  const value = Date.parse(dateKey + "T00:00:00.000Z") + days * DAY_MS;
  return dateKeyFromUtcDay(value);
}

function monthStartKey(year: number, monthIndex: number) {
  return new Date(Date.UTC(year, monthIndex, 1)).toISOString().slice(0, 10);
}

function addMonths(year: number, monthIndex: number, amount: number) {
  const date = new Date(Date.UTC(year, monthIndex + amount, 1));
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
}

type CampaignRow = {
  sponsor_id: string;
  slot_code: string;
  starts_at: string;
  ends_at: string;
};

export async function GET() {
  try {
    const now = new Date();
    const today = jakartaDateParts(now);
    const firstMonth = { year: today.year, monthIndex: today.month - 1 };
    const rangeStart = monthStartKey(firstMonth.year, firstMonth.monthIndex);
    const afterLastMonth = addMonths(firstMonth.year, firstMonth.monthIndex, 12);
    const rangeEndExclusive = monthStartKey(afterLastMonth.year, afterLastMonth.monthIndex);
    const startIso = jakartaMidnightIso(rangeStart);
    const endIso = jakartaMidnightIso(rangeEndExclusive);

    const supabase = getSupabaseAdmin();
    const [{ data: slots, error: slotsError }, { data: campaigns, error: campaignsError }] = await Promise.all([
      supabase.from("ad_slots").select("slot_code,display_name,max_visible,is_enabled").in("slot_code", [...SLOT_CODES]).order("slot_code"),
      supabase.from("ad_campaigns")
        .select("sponsor_id,slot_code,starts_at,ends_at")
        .in("slot_code", [...SLOT_CODES])
        .in("status", ["active", "scheduled"])
        .lt("starts_at", endIso)
        .gt("ends_at", startIso)
        .order("starts_at", { ascending: true })
        .limit(5000),
    ]);
    if (slotsError || campaignsError) {
      console.error("Advertising availability query failed:", slotsError?.code, campaignsError?.code);
      return NextResponse.json({ error: "Gagal memuat ketersediaan iklan." }, { status: 500 });
    }

    const slotConfig = new Map((slots ?? []).map(slot => [slot.slot_code, slot]));
    const rows = (campaigns ?? []) as CampaignRow[];
    const bookingsBySlot = new Map<string, Map<string, CampaignRow[]>>();
    for (const row of rows) {
      if (!row.sponsor_id || !SLOT_CODES.includes(row.slot_code as typeof SLOT_CODES[number])) continue;
      const bySponsor = bookingsBySlot.get(row.slot_code) ?? new Map<string, CampaignRow[]>();
      const sponsorRows = bySponsor.get(row.sponsor_id) ?? [];
      sponsorRows.push(row);
      bySponsor.set(row.sponsor_id, sponsorRows);
      bookingsBySlot.set(row.slot_code, bySponsor);
    }

    const slotsResponse = SLOT_CODES.map(slotCode => {
      const config = slotConfig.get(slotCode);
      const capacity = config?.is_enabled ? Math.max(0, Number(config.max_visible) || 0) : 0;
      const sponsorRows = bookingsBySlot.get(slotCode) ?? new Map<string, CampaignRow[]>();
      const intervals: Array<{ start: string; end: string }> = [];
      for (const campaignsForSponsor of sponsorRows.values()) {
        const sorted = campaignsForSponsor.map(row => ({
          start: row.starts_at < startIso ? rangeStart : jakartaDateParts(new Date(row.starts_at)).year + "-" +
            String(jakartaDateParts(new Date(row.starts_at)).month).padStart(2, "0") + "-" +
            String(jakartaDateParts(new Date(row.starts_at)).day).padStart(2, "0"),
          end: row.ends_at >= endIso ? addDays(rangeEndExclusive, -1) : (() => {
            const p = jakartaDateParts(new Date(row.ends_at));
            return p.year + "-" + String(p.month).padStart(2, "0") + "-" + String(p.day).padStart(2, "0");
          })(),
        })).sort((a, b) => a.start.localeCompare(b.start));
        const merged: Array<{ start: string; end: string }> = [];
        for (const interval of sorted) {
          const last = merged[merged.length - 1];
          if (last && interval.start <= addDays(last.end, 1)) {
            if (interval.end > last.end) last.end = interval.end;
          } else merged.push({ ...interval });
        }
        intervals.push(...merged);
      }

      const days: Record<string, { booked: number; available: number; capacity: number; isEnabled: boolean }> = {};
      for (let day = rangeStart; day < rangeEndExclusive; day = addDays(day, 1)) {
        const booked = Array.from(sponsorRows.entries()).filter(([, sponsorCampaigns]) =>
          sponsorCampaigns.some(row => row.starts_at < jakartaMidnightIso(addDays(day, 1)) && row.ends_at >= jakartaMidnightIso(day))
        ).length;
        days[day] = { booked, available: Math.max(0, capacity - booked), capacity, isEnabled: Boolean(config?.is_enabled) };
      }
      return {
        code: slotCode,
        name: config?.display_name || SLOT_LABELS[slotCode],
        capacity,
        enabled: Boolean(config?.is_enabled),
        days,
        periods: intervals,
      };
    });

    return NextResponse.json({
      timeZone: TIME_ZONE,
      generatedAt: now.toISOString(),
      range: { start: rangeStart, endExclusive: rangeEndExclusive, today: today.year + "-" + String(today.month).padStart(2, "0") + "-" + String(today.day).padStart(2, "0") },
      slots: slotsResponse,
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Advertising availability GET failed:", error);
    return NextResponse.json({ error: "Terjadi kesalahan saat memuat kalender iklan." }, { status: 500 });
  }
}
