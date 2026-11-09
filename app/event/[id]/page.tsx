
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const BASE_URL = "https://ngipen.my.id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type EventData = {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  categories: string[] | null;
  province: string | null;
  city: string | null;
  venue_address: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  ticket_type: string | null;
  ticket_url: string | null;
  registration_url: string | null;
  social_link: string | null;
  created_at: string | null;
};

type Props = {
  params: {
    id: string;
  };
};

async function getEvent(id: string): Promise<EventData | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Konfigurasi Supabase server belum lengkap.");
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      description,
      poster_url,
      categories,
      province,
      city,
      venue_address,
      start_date,
      end_date,
      start_time,
      end_time,
      ticket_type,
      ticket_url,
      registration_url,
      social_link,
      created_at
    `)
    .eq("id", id)
    .eq("moderation_status", "Approved")
    .eq("is_hidden", false)
    .maybeSingle();

  if (error) {
    console.error("Gagal mengambil data event:", error.message);
    return null;
  }

  return data as EventData | null;
}

function getCanonicalUrl(id: string) {
  return `${BASE_URL}/event/${encodeURIComponent(id)}`;
}

function getSafeExternalUrl(value: string | null | undefined) {
  if (!value) return undefined;

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.toString();
  } catch {
    return undefined;
  }
}

function getSchemaDate(date: string | null, time: string | null) {
  if (!date) return undefined;

  const validTime =
    time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      ? `${time}:00`
      : "00:00:00";

  return `${date}T${validTime}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateRange(
  startDate: string | null,
  endDate: string | null
) {
  if (!startDate) return "-";

  if (!endDate || startDate === endDate) {
    return formatDate(startDate);
  }

  return `${formatDate(startDate)} – ${formatDate(endDate)}`;
}

function getStructuredData(event: EventData, canonicalUrl: string) {
  const ticketUrl =
    getSafeExternalUrl(event.ticket_url) ||
    getSafeExternalUrl(event.registration_url);

  const structuredData: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description || `Informasi event ${event.title} di NGIPEN.`,
    url: canonicalUrl,
    inLanguage: "id-ID",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    isAccessibleForFree: event.ticket_type === "Gratis",
  };

  if (event.poster_url) {
    structuredData.image = [event.poster_url];
  }

  const startDate = getSchemaDate(event.start_date, event.start_time);
  const endDate = getSchemaDate(event.end_date, event.end_time);

  if (startDate) structuredData.startDate = startDate;
  if (endDate) structuredData.endDate = endDate;

  if (event.city || event.province || event.venue_address) {
    structuredData.location = {
      "@type": "Place",
      name: event.venue_address || event.city || event.province,
      address: {
        "@type": "PostalAddress",
        streetAddress: event.venue_address || undefined,
        addressLocality: event.city || undefined,
        addressRegion: event.province || undefined,
        addressCountry: "ID",
      },
    };
  }

  if (event.categories?.length) {
    structuredData.about = event.categories.map((category) => ({
      "@type": "Thing",
      name: category,
    }));
  }

  if (ticketUrl) {
    structuredData.offers = {
      "@type": "Offer",
      url: ticketUrl,
      availability: "https://schema.org/InStock",
      ...(event.ticket_type === "Gratis"
        ? {
            price: "0",
            priceCurrency: "IDR",
          }
        : {}),
    };
  }

  return structuredData;
}

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const event = await getEvent(params.id);

  if (!event) {
    return {
      title: "Event tidak ditemukan | NGIPEN",
      description: "Event ini tidak tersedia di NGIPEN.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const canonicalUrl = getCanonicalUrl(event.id);
  const title = `${event.title} | NGIPEN`;

  const description = (
    event.description?.trim() ||
    `Lihat informasi event ${event.title} di NGIPEN – MAKICOS.`
  ).slice(0, 200);

  const poster =
    event.poster_url || `${BASE_URL}/ngipen-og-preview.jpg`;

  return {
    metadataBase: new URL(BASE_URL),
    title,
    description,

    alternates: {
      canonical: canonicalUrl,
    },

    robots: {
      index: true,
      follow: true,
    },

    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "NGIPEN",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: poster,
          alt: `Poster event ${event.title}`,
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

export default async function EventPage({ params }: Props) {
  const event = await getEvent(params.id);

  if (!event) {
    notFound();
  }

  const canonicalUrl = getCanonicalUrl(event.id);
  const structuredData = getStructuredData(event, canonicalUrl);

  const ticketUrl = getSafeExternalUrl(event.ticket_url);
  const registrationUrl = getSafeExternalUrl(event.registration_url);
  const socialUrl = getSafeExternalUrl(event.social_link);

  const appUrl = `/?event=${encodeURIComponent(event.id)}`;

  return (
    <main className="min-h-screen bg-[#F7F7F8] px-4 py-8 text-[#242424]">
      <div className="mx-auto max-w-4xl">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />

        <header className="mb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold hover:border-red-500 hover:text-red-600"
          >
            ← Beranda NGIPEN
          </a>
        </header>

        <article className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {event.poster_url && (
            <div className="bg-gray-100 text-center">
              <img
                src={event.poster_url}
                alt={`Poster event ${event.title}`}
                className="mx-auto block max-h-[720px] w-full object-contain"
              />
            </div>
          )}

          <div className="p-5 sm:p-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-red-600">
              Informasi Event Jejepangan
            </p>

            <h1 className="text-2xl font-black leading-tight sm:text-4xl">
              {event.title}
            </h1>

            {event.categories && event.categories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {event.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 grid gap-4 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold text-gray-500">
                  Tanggal Event
                </p>
                <p className="mt-1 font-bold">
                  {formatDateRange(event.start_date, event.end_date)}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500">
                  Waktu
                </p>
                <p className="mt-1 font-bold">
                  {event.start_time || "-"}
                  {event.end_time ? ` – ${event.end_time} WIB` : ""}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500">
                  Lokasi
                </p>
                <p className="mt-1 font-bold">
                  {[event.city, event.province].filter(Boolean).join(", ") || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500">
                  Tempat Acara
                </p>
                <p className="mt-1 font-bold">
                  {event.venue_address || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500">
                  Jenis Tiket
                </p>
                <p className="mt-1 font-bold">
                  {event.ticket_type || "-"}
                </p>
              </div>

            </div>

            <section className="mt-8 overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-red-100 bg-gradient-to-r from-red-50 to-white px-4 py-3">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-lg shadow-sm">⛩️</span>
                <div><h2 className="text-xl font-black">Tentang Event</h2><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600">Deskripsi kegiatan</p></div>
              </div>
              <div className="p-4 sm:p-5"><p className="whitespace-pre-line text-sm leading-7 text-gray-700">{event.description || "Informasi event belum tersedia."}</p></div>
              <div className="grid gap-px border-t border-red-100 bg-red-100 sm:grid-cols-2">
                <div className="bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Kategori</p><p className="mt-1 text-sm font-semibold text-gray-800">{(event.categories || []).join(", ") || "Belum ditentukan"}</p></div>
                <div className="bg-white px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Tiket</p><p className="mt-1 text-sm font-semibold text-gray-800">{event.ticket_type || "Belum ditentukan"}</p></div>
              </div>
            </section>

            {(ticketUrl || registrationUrl || socialUrl) && (
              <section className="mt-8">
                <h2 className="text-lg font-black">Informasi dan Tautan</h2>

                <div className="mt-3 flex flex-wrap gap-3">
                  {ticketUrl && (
                    <a
                      href={ticketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700"
                    >
                      Informasi Tiket
                    </a>
                  )}

                  {registrationUrl && (
                    <a
                      href={registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-red-600 px-5 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
                    >
                      Registrasi
                    </a>
                  )}

                  {socialUrl && (
                    <a
                      href={socialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-gray-300 px-5 py-3 text-sm font-bold hover:border-red-500 hover:text-red-600"
                    >
                      Media Sosial / Info Event
                    </a>
                  )}
                </div>
              </section>
            )}

            <div className="mt-10 rounded-2xl bg-red-50 p-5 text-center">
              <h2 className="text-lg font-black text-gray-900">
                Ingin melihat event ini di NGIPEN?
              </h2>

              <p className="mt-2 text-sm text-gray-600">
                Buka halaman aplikasi NGIPEN untuk melihat detail event dan
                menggunakan fitur yang tersedia.
              </p>

              <a
                href={appUrl}
                className="mt-5 inline-flex rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700"
              >
                Buka Event di NGIPEN
              </a>
            </div>
          </div>
        </article>

        <footer className="py-8 text-center text-xs text-gray-500">
          NGIPEN – Satu Hobby Satu Keseruan.
          <br />
          MARI KITA COSPLAY, MAKICOS ID
        </footer>
      </div>
    </main>
  );
}
