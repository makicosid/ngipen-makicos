import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://ngipen.my.id";

export const runtime = "nodejs";
export const revalidate = 3600;

type SitemapEvent = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/tentang-kami`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Sitemap NGIPEN: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi. URL event tidak dapat dimuat."
    );
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
        .select("id, created_at, updated_at")
        .eq("moderation_status", "Approved")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error(
          "Sitemap NGIPEN: gagal mengambil event dari Supabase:",
          error.message
        );
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
      const modifiedAt = event.updated_at || event.created_at;
      const parsedModifiedAt = modifiedAt ? new Date(modifiedAt) : null;

      sitemapEntries.push({
        url: `${BASE_URL}/event/${encodeURIComponent(event.id)}`,
        ...(parsedModifiedAt && !Number.isNaN(parsedModifiedAt.getTime())
          ? { lastModified: parsedModifiedAt }
          : {}),
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
