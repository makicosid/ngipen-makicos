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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function normalizeLocation(value: unknown) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.toLocaleLowerCase("id-ID") : "";
}

function displayLocation(value: unknown) {
  const cleaned = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned.toLocaleLowerCase("id-ID").replace(/(^|[ -])([a-z])/g, (_match, separator, letter) => separator + letter.toLocaleUpperCase("id-ID"));
}

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("ngipen_admin_session")?.value;
    if (!token) return json({ error: "Akses Admin diperlukan." }, 401);

    const supabase = getSupabaseAdmin();
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const { data: session, error: sessionError } = await supabase
      .from("admin_sessions")
      .select("token_hash")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError) {
      console.error("Admin location stats session error:", sessionError);
      return json({ error: "Gagal memeriksa sesi Admin." }, 500);
    }
    if (!session) return json({ error: "Sesi Admin tidak valid atau sudah berakhir." }, 401);

    const allRows: Array<{ province: string | null; city: string | null; moderation_status: string | null; is_hidden: boolean | null }> = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("events")
        .select("province,city,moderation_status,is_hidden")
        .range(from, from + pageSize - 1);
      if (error) {
        console.error("Admin location stats query error:", error);
        return json({ error: "Gagal mengambil statistik lokasi event." }, 500);
      }
      const rows = data || [];
      allRows.push(...rows);
      if (rows.length < pageSize) break;
    }

    type CityStats = { name: string; total: number; approved: number; pending: number; rejected: number; hidden: number };
    type ProvinceStats = CityStats & { cities: CityStats[] };
    const provinces = new Map<string, ProvinceStats>();
    const missing = new Map<string, CityStats>();

    const createStats = (name: string): CityStats => ({ name, total: 0, approved: 0, pending: 0, rejected: 0, hidden: 0 });
    for (const row of allRows) {
      const provinceName = displayLocation(row.province) || "Provinsi belum diisi";
      const cityName = displayLocation(row.city) || "Kota belum diisi";
      const provinceKey = normalizeLocation(row.province) || "__missing_province__";
      const cityKey = normalizeLocation(row.city) || "__missing_city__";
      const hidden = row.is_hidden === true;
      const status = hidden ? "hidden" : String(row.moderation_status || "").toLowerCase();
      const bucket = status === "approved" ? "approved" : status === "pending" ? "pending" : status === "rejected" ? "rejected" : status === "hidden" ? "hidden" : "pending";

      if (provinceKey === "__missing_province__" || cityKey === "__missing_city__") {
        const key = provinceKey === "__missing_province__" ? "__missing_province__" : "__missing_city__";
        const label = provinceKey === "__missing_province__" ? "Provinsi belum diisi" : "Kota belum diisi";
        if (!missing.has(key)) missing.set(key, createStats(label));
        const stats = missing.get(key)!;
        stats.total += 1;
        stats[bucket] += 1;
        continue;
      }

      if (!provinces.has(provinceKey)) provinces.set(provinceKey, { ...createStats(provinceName), cities: [] });
      const province = provinces.get(provinceKey)!;
      province.total += 1;
      province[bucket] += 1;
      let city = province.cities.find((item) => normalizeLocation(item.name) === cityKey);
      if (!city) {
        city = createStats(cityName);
        province.cities.push(city);
      }
      city.total += 1;
      city[bucket] += 1;
    }

    const sorted = Array.from(provinces.values())
      .map((province) => ({ ...province, cities: province.cities.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "id")) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "id"));

    return json({
      success: true,
      totalEvents: allRows.length,
      provinceCount: sorted.length,
      provinces: sorted,
      missingLocations: Array.from(missing.values()),
    });
  } catch (error) {
    console.error("Admin location stats API error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
