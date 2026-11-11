import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://ngipen.my.id";

export const runtime = "nodejs";
export const revalidate = 3600;

type SitemapEvent = {
  id: string;
  created_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Always return the core public URLs, even if Supabase is unavailable.
  const sitemapEntries: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/tentang-kami`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Sitemap NGIPEN: NEXT_PUBLIC_SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi."
    );
    return sitemapEntries;
  }

  try {
    // Create the client inside try so invalid configuration cannot crash
    // the sitemap route before the fallback response is returned.
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const pageSize = 1000;
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("events")
        .select("id, created_at")
        .eq("moderation_status", "Approved")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) {
        console.error(
          "Sitemap NGIPEN: gagal mengambil event dari Supabase:",
          error.message
        );
        // Keep the sitemap valid with the core URLs if event lookup fails.
        return sitemapEntries;
      }

      const batch = (data ?? []) as SitemapEvent[];

      for (const event of batch) {
        sitemapEntries.push({
          url: `${BASE_URL}/event/${encodeURIComponent(event.id)}`,
          ...(event.created_at && !Number.isNaN(Date.parse(event.created_at))
            ? { lastModified: new Date(event.created_at) }
            : {}),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }

      if (batch.length < pageSize) {
        break;
      }

      from += pageSize;
    }
  } catch (error) {
    console.error("Sitemap NGIPEN gagal dibuat:", error);
    // Return a valid sitemap containing the core public URLs as a fallback.
    return sitemapEntries;
  }

  return sitemapEntries;
}
