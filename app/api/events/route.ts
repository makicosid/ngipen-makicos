import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";

const USER_COOKIE_NAME = "ngipen_session";
const ADMIN_COOKIE_NAME = "ngipen_admin_session";

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hasValidAdminSession(
  request: NextRequest,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Event API admin session check error:", error);
    throw new Error("Gagal memeriksa sesi admin.");
  }

  return Boolean(data);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const isAdmin = await hasValidAdminSession(request, supabase);

    let query = supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
  query = query
    .eq("moderation_status", "Approved")
    .eq("is_hidden", false);
}
    const { data: events, error } = await query;

    if (error) {
      console.error("Get events API error:", error);
      return json({ error: "Gagal memuat data event." }, 500);
    }

    return json({ success: true, events: events || [] });
  } catch (error) {
    console.error("Events API error:", error);
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}

const POSTER_BUCKET = "posters";
const MAX_POSTER_SIZE = 3 * 1024 * 1024;

const ALLOWED_CATEGORIES = [
  "Cosplay",
  "Pefomance",
  "Market",
  "Game",
  "Comic",
];

const ALLOWED_PROVINCES = [
  "Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Jambi",
  "Sumatera Selatan", "Bengkulu", "Lampung", "Kepulauan Bangka Belitung",
  "Kepulauan Riau", "DKI Jakarta", "Jawa Barat", "Jawa Tengah",
  "DI Yogyakarta", "Jawa Timur", "Banten", "Bali",
  "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat",
  "Kalimantan Tengah", "Kalimantan Selatan", "Kalimantan Timur",
  "Kalimantan Utara", "Sulawesi Utara", "Sulawesi Tengah",
  "Sulawesi Selatan", "Sulawesi Tenggara", "Gorontalo",
  "Sulawesi Barat", "Maluku", "Maluku Utara", "Papua",
  "Papua Barat", "Papua Selatan", "Papua Tengah",
  "Papua Pegunungan", "Papua Barat Daya",
];

async function getUserSession(
  request: NextRequest,
  supabase: ReturnType<typeof getSupabaseAdmin>
) {
  const token = request.cookies.get(USER_COOKIE_NAME)?.value;
  if (!token) return null;

  const { data, error } = await supabase
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    console.error("Create event session check error:", error);
    throw new Error("Gagal memeriksa sesi login.");
  }

  return data;
}

function isValidUrl(value: string) {
  if (!value) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getImageDimensions(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } | null {
  if (mimeType === "image/png") {
    if (
      buffer.length < 24 ||
      !buffer.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      )
    ) return null;

    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  if (mimeType === "image/jpeg") {
    if (
      buffer.length < 4 ||
      buffer[0] !== 0xff ||
      buffer[1] !== 0xd8
    ) return null;

    let offset = 2;

    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }

      const marker = buffer[offset + 1];
      offset += 2;

      if (
        marker === 0xd8 ||
        marker === 0xd9 ||
        (marker >= 0xd0 && marker <= 0xd7)
      ) continue;

      if (offset + 2 > buffer.length) return null;

      const length = buffer.readUInt16BE(offset);

      if (
        length < 2 ||
        offset + length > buffer.length
      ) return null;

      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3,
          0xc5, 0xc6, 0xc7, 0xc9,
          0xca, 0xcb, 0xcd, 0xce, 0xcf,
        ].includes(marker)
      ) {
        if (length < 7) return null;

        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
        };
      }

      offset += length;
    }

    return null;
  }

  if (mimeType === "image/webp") {
    if (
      buffer.length < 30 ||
      buffer.toString("ascii", 0, 4) !== "RIFF" ||
      buffer.toString("ascii", 8, 12) !== "WEBP"
    ) return null;

    const chunk = buffer.toString("ascii", 12, 16);

    if (chunk === "VP8X") {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }

    if (
      chunk === "VP8 " &&
      buffer.length >= 30 &&
      buffer[23] === 0x9d &&
      buffer[24] === 0x01 &&
      buffer[25] === 0x2a
    ) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }

    if (
      chunk === "VP8L" &&
      buffer.length >= 25 &&
      buffer[20] === 0x2f
    ) {
      const b1 = buffer[21];
      const b2 = buffer[22];
      const b3 = buffer[23];
      const b4 = buffer[24];

      return {
        width: 1 + b1 + ((b2 & 0x3f) << 8),
        height:
          1 +
          ((b2 >> 6) & 0x03) +
          (b3 << 2) +
          ((b4 & 0x0f) << 10),
      };
    }

    return null;
  }

  return null;
}

// POST: Membuat event dan mengunggah poster melalui server.
export async function POST(request: NextRequest) {
  let uploadedPath: string | null = null;
  let supabase: ReturnType<typeof getSupabaseAdmin> | null = null;

  try {
    const origin = request.headers.get("origin");

    if (!origin || origin !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    supabase = getSupabaseAdmin();

    const session = await getUserSession(request, supabase);

    if (!session) {
      return json({
        error: "Sesi login tidak valid. Silakan login kembali.",
      }, 401);
    }

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username, display_name")
      .eq("id", session.user_id)
      .maybeSingle();

    if (userError || !user) {
      return json({
        error: "Akun pengguna tidak ditemukan.",
      }, 401);
    }

    const form = await request.formData();

    const value = (key: string) => {
      const item = form.get(key);
      return typeof item === "string" ? item.trim() : "";
    };

    const title = value("title");
    const description = value("description");
    const province = value("province");
    const city = value("city");
    const venue = value("venue_address");
    const startDate = value("start_date");
    const endDate = value("end_date");
    const startTime = value("start_time") || "09:00";
    const endTime = value("end_time") || "18:00";
    const ticketType = value("ticket_type");
    const ticketUrl = value("ticket_url");
    const registrationUrl = value("registration_url");
    const socialLink = value("social_link");

    if (title.length < 3 || title.length > 150) {
      return json({
        error: "Judul event harus 3–150 karakter.",
      }, 400);
    }

    if (description.length < 20 || description.length > 5000) {
      return json({
        error: "Deskripsi event harus 20–5.000 karakter.",
      }, 400);
    }

    if (!ALLOWED_PROVINCES.includes(province)) {
      return json({ error: "Provinsi tidak valid." }, 400);
    }

    if (!city || city.length > 100) {
      return json({
        error: "Kota/kabupaten wajib diisi (maksimal 100 karakter).",
      }, 400);
    }

    if (!venue || venue.length > 300) {
      return json({
        error: "Alamat/tempat acara wajib diisi (maksimal 300 karakter).",
      }, 400);
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(endDate) ||
      endDate < startDate
    ) {
      return json({ error: "Tanggal event tidak valid." }, 400);
    }

    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    ) {
      return json({ error: "Jam event tidak valid." }, 400);
    }

    if (
      ticketType !== "Gratis" &&
      ticketType !== "Berbayar"
    ) {
      return json({ error: "Jenis tiket tidak valid." }, 400);
    }

    if (ticketType === "Berbayar" && !ticketUrl) {
      return json({
        error: "Link tiket wajib untuk event berbayar.",
      }, 400);
    }

    if (
      ![ticketUrl, registrationUrl, socialLink].every(isValidUrl)
    ) {
      return json({
        error: "Link harus menggunakan http:// atau https:// yang valid.",
      }, 400);
    }

    let categories: unknown;

    try {
      categories = JSON.parse(value("categories"));
    } catch {
      categories = null;
    }

    if (
      !Array.isArray(categories) ||
      categories.length < 1 ||
      categories.length > ALLOWED_CATEGORIES.length ||
      categories.some(
        (item) =>
          typeof item !== "string" ||
          !ALLOWED_CATEGORIES.includes(item)
      ) ||
      new Set(categories).size !== categories.length
    ) {
      return json({
        error: "Kategori event tidak valid. Pilih minimal satu kategori.",
      }, 400);
    }

    const poster = form.get("poster");

    if (!(poster instanceof File) || poster.size === 0) {
      return json({
        error: "Poster event wajib diunggah.",
      }, 400);
    }

    if (poster.size > MAX_POSTER_SIZE) {
      return json({
        error: "Ukuran poster maksimal 3 MB.",
      }, 400);
    }

    if (
      !["image/jpeg", "image/png", "image/webp"].includes(poster.type)
    ) {
      return json({
        error: "Format poster harus JPG, PNG, atau WebP.",
      }, 400);
    }

    const posterBuffer = Buffer.from(await poster.arrayBuffer());

    const dimensions = getImageDimensions(
      posterBuffer,
      poster.type
    );

    if (
      !dimensions ||
      dimensions.width < 1 ||
      dimensions.height < 1
    ) {
      return json({
        error: "File poster tidak valid atau tidak dapat dibaca.",
      }, 400);
    }

    const ratio = dimensions.width / dimensions.height;
    const allowedRatios = [3 / 4, 1, 4 / 5, 9 / 16];

    if (
      !allowedRatios.some(
        (allowed) => Math.abs(ratio - allowed) <= 0.02
      )
    ) {
      return json({
        error: "Rasio poster harus 3:4, 1:1, 4:5, atau 9:16.",
      }, 400);
    }

    const extension =
      poster.type === "image/jpeg"
        ? "jpg"
        : poster.type === "image/png"
          ? "png"
          : "webp";

    uploadedPath = `events/${randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(POSTER_BUCKET)
      .upload(uploadedPath, posterBuffer, {
        upsert: false,
        cacheControl: "3600",
        contentType: poster.type,
      });

    if (uploadError) {
      console.error("Event poster upload error:", uploadError);
      uploadedPath = null;

      return json({
        error: "Gagal mengunggah poster event.",
      }, 500);
    }

    const { data: publicUrlData } = supabase.storage
      .from(POSTER_BUCKET)
      .getPublicUrl(uploadedPath);

    const posterUrl =
      `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const payload = {
      organizer_id: user.id,
      title,
      slug: slugify(title),
      description,
      poster_url: posterUrl,
      categories,
      province,
      city,
      venue_address: venue,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      ticket_type: ticketType,
      ticket_url: ticketUrl || null,
      registration_url: registrationUrl || null,
      social_link: socialLink || null,
      moderation_status: "Pending",
      is_sponsored: false,
      sponsored_priority: 0,
      views: 0,
      saves_count: 0,
      avg_rating: 0,
      rating_count: 0,
      organizer_name: user.display_name || user.username,
    };

    const { data: event, error: insertError } = await supabase
      .from("events")
      .insert(payload)
      .select()
      .single();

    if (insertError || !event) {
      console.error("Create event insert error:", insertError);

      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from(POSTER_BUCKET)
          .remove([uploadedPath]);

        if (cleanupError) {
          console.error("Event poster cleanup error:", cleanupError);
        }

        uploadedPath = null;
      }

      return json({
        error: "Gagal menyimpan event. Silakan coba kembali.",
      }, 500);
    }

    return json({ success: true, event }, 201);
  } catch (error) {
    console.error("Create event API error:", error);

    if (supabase && uploadedPath) {
      const { error: cleanupError } = await supabase.storage
        .from(POSTER_BUCKET)
        .remove([uploadedPath]);

      if (cleanupError) {
        console.error("Event poster cleanup error:", cleanupError);
      }
    }

    return json({
      error: "Terjadi kesalahan pada server saat menyimpan event.",
    }, 500);
  }
}
