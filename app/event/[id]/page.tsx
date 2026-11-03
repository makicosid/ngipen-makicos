
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import EventRedirect from "./redirect-client";

const BASE_URL = "https://ngipen-makicos-seven.vercel.app";

export const dynamic = "force-dynamic";

async function getEvent(id: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from("events")
    .select("id, title, description, poster_url")
    .eq("id", id)
    .eq("moderation_status", "Approved")
    .maybeSingle();

  if (error) {
    console.error("Gagal mengambil metadata event:", error.message);
    return null;
  }

  return data;
}

type Props = {
  params: {
    id: string;
  };
};

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const event = await getEvent(params.id);

  if (!event) {
    return {
      title: "Event tidak ditemukan - NGIPEN",
      description: "Lihat berbagai event jejepangan di NGIPEN.",
    };
  }

  const title = `${event.title} | NGIPEN`;
  const description = (
    event.description ||
    `Lihat informasi event ${event.title} di NGIPEN – MAKICOS.`
  ).slice(0, 200);

  const poster = event.poster_url || `${BASE_URL}/ngipen-og-preview.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/event/${params.id}`,
      siteName: "NGIPEN",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: poster,
          alt: `Poster ${event.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [poster],
    },
  };
}

export default function EventPage({ params }: Props) {
  return <EventRedirect eventId={params.id} />;
}
