
import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://ngipen-makicos-seven.vercel.app";

export const runtime = "nodejs";
export const revalidate = 3600;

type SitemapEvent = {
  id: string;
  created_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Konfigurasi Supabase sitemap belum lengkap.");
    return sitemapEntries;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const pageSize = 1000;
  let from = 0;
  const events: SitemapEvent[] = [];

  try {
    while (true) {
      const { data, error } = await supabase
        .from("events")
        .select("id, created_at")
        .eq("moderation_status", "Approved")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Gagal mengambil event untuk sitemap:", error.message);
        return sitemapEntries;
      }

      const batch = (data || []) as SitemapEvent[];
      events.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    for (const event of events) {
      sitemapEntries.push({
        url: `${BASE_URL}/event/${encodeURIComponent(event.id)}`,
        lastModified: event.created_at
          ? new Date(event.created_at)
          : new Date(),
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }

    return sitemapEntries;
  } catch (error) {
    console.error("Sitemap NGIPEN gagal dibuat:", error);
    return sitemapEntries;
  }
}
