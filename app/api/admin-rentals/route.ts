
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_admin_session";
const USER_COOKIE_NAME = "ngipen_session";
const BUCKET = "costume-rentals";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const RENTAL_COLUMNS = "id, name, region, province, city, instagram_url, image_url, image_path, display_order, created_at, is_verified, is_subscription, whatsapp_number, subscription_expires_at";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Konfigurasi Supabase server belum lengkap.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return false;

  const { data, error } = await getSupabaseAdmin()
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return !error && !!data;
}

async function requireUser(request: NextRequest) {
  const token = request.cookies.get(USER_COOKIE_NAME)?.value;

  if (!token) return false;

  const { data, error } = await getSupabaseAdmin()
    .from("ngipen_sessions")
    .select("user_id")
    .eq("token_hash", hashToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return !error && !!data;
}

function validOrigin(request: NextRequest) {
  return request.headers.get("origin") === request.nextUrl.origin;
}

function validInstagramUrl(value: string) {
  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);

    return (
      url.protocol === "https:" &&
      (url.hostname === "instagram.com" ||
        url.hostname === "www.instagram.com") &&
      parts.length === 1 &&
      !["p", "reel", "reels", "stories", "explore"].includes(
        parts[0].toLowerCase()
      )
    );
  } catch {
    return false;
  }
}

function normalizeWhatsapp(value: string) {
  const normalized = value.trim().replace(/[\s()-]/g, "");

  if (!normalized) return null;

  if (!/^\+?\d{8,15}$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeSubscriptionExpiry(value: string) {
  const date = value.trim();

  if (!date) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return undefined;
  }

  const parsed = new Date(`${date}T23:59:59+07:00`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return undefined;
  }

  return parsed.toISOString();
}

function getImageExtension(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return null;
}

function isValidImage(buffer: Buffer, type: string) {
  if (type === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (type === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

async function uploadImage(file: File) {
  const extension = getImageExtension(file.type);

  if (!extension) {
    throw new Error("Foto harus JPG, PNG, atau WebP.");
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Ukuran foto maksimal 5 MB.");
  }

  const path = `${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size || !isValidImage(buffer, file.type)) {
    throw new Error("File bukan gambar JPG, PNG, atau WebP yang valid.");
  }

  const { error } = await getSupabaseAdmin()
    .storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw new Error("Gagal mengunggah foto rental.");
  }

  const { data } = getSupabaseAdmin()
    .storage
    .from(BUCKET)
    .getPublicUrl(path);

  return {
    image_path: path,
    image_url: data.publicUrl,
  };
}

async function removeImage(path: string) {
  if (!path) return;

  const { error } = await getSupabaseAdmin()
    .storage
    .from(BUCKET)
    .remove([path]);

  if (error) {
    console.error("Rental image cleanup error:", error);
  }
}

// GET: Guest hanya menerima maksimal 3 rental Subscription aktif.
// User login dan admin menerima seluruh daftar rental.
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const isAdmin = await requireAdmin(request);
    const isUser = !isAdmin && await requireUser(request);
    const isGuest = !isAdmin && !isUser;
    const now = new Date();

    let rentalQuery = supabase
      .from("costume_rentals")
      .select(RENTAL_COLUMNS)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (isGuest) {
      rentalQuery = rentalQuery
        .eq("is_subscription", true)
        .gt("subscription_expires_at", now.toISOString())
        .limit(3);
    }

    const { data, error } = await rentalQuery;

    if (error) {
      console.error("Rental list error:", error);
      return json({ error: "Gagal mengambil daftar rental." }, 500);
    }

    const rentals = await Promise.all(
      (data || []).map(async (rental) => {
        const expiry = rental.subscription_expires_at
          ? new Date(rental.subscription_expires_at).getTime()
          : 0;

        const isSubscriptionActive =
          rental.is_subscription === true &&
          expiry > now.getTime();

        // Guest hanya memerlukan data untuk kartu promosi Subscription.
        // Kontak, statistik, dan data pengelolaan tidak dikirim ke Guest.
        if (isGuest) {
          return {
            id: rental.id,
            name: rental.name,
            region: rental.region,
            image_url: rental.image_url,
            is_subscription_active: isSubscriptionActive,
          };
        }

        const { count, error: countError } = await supabase
          .from("costume_rental_clicks")
          .select("id", { count: "exact", head: true })
          .eq("rental_id", rental.id);

        if (countError) {
          throw countError;
        }

        const fullRental = {
          id: rental.id,
          name: rental.name,
          region: rental.region,
          province: rental.province,
          city: rental.city,
          instagram_url: rental.instagram_url,
          image_url: rental.image_url,
          display_order: rental.display_order,
          created_at: rental.created_at,
          is_verified: rental.is_verified,
          whatsapp_number: rental.whatsapp_number,
          total_views: count ?? 0,
          is_subscription_active: isSubscriptionActive,
        };

        return isAdmin
          ? {
              ...fullRental,
              image_path: rental.image_path,
              is_subscription: rental.is_subscription,
              subscription_expires_at: rental.subscription_expires_at,
            }
          : fullRental;
      })
    );

    return json({ rentals });
  } catch (error) {
    console.error("Rental GET error:", error);
    return json({ error: "Terjadi kesalahan server." }, 500);
  }
}

// POST: tambah rental
export async function POST(request: NextRequest) {
  try {
    if (!validOrigin(request)) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    if (!(await requireAdmin(request))) {
      return json({ error: "Sesi admin tidak valid." }, 401);
    }

    const form = await request.formData();

    const name = String(form.get("name") || "").trim();
    const region = String(form.get("region") || "").trim();
    const province = String(form.get("province") || "").trim();
    const city = String(form.get("city") || "").trim();
    const instagramUrl = String(form.get("instagram_url") || "").trim();
    const whatsappRaw = String(form.get("whatsapp_number") || "");
    const file = form.get("image");

    if (!name || name.length > 100) {
      return json(
        { error: "Nama rental wajib diisi (maksimal 100 karakter)." },
        400
      );
    }

    if (!region || region.length > 120) {
      return json(
        { error: "Daerah rental wajib diisi (maksimal 120 karakter)." },
        400
      );
    }

    if (province.length > 100 || city.length > 100) {
      return json(
        { error: "Provinsi dan kota maksimal 100 karakter." },
        400
      );
    }

    if (!validInstagramUrl(instagramUrl)) {
      return json(
        { error: "Masukkan link profil Instagram yang valid." },
        400
      );
    }

    const whatsappNumber = normalizeWhatsapp(whatsappRaw);

    if (whatsappNumber === undefined) {
      return json(
        { error: "Nomor WhatsApp tidak valid. Gunakan 8–15 digit." },
        400
      );
    }

    if (!(file instanceof File)) {
      return json({ error: "Foto rental wajib diunggah." }, 400);
    }

    const image = await uploadImage(file);

    const { data, error } = await getSupabaseAdmin()
      .from("costume_rentals")
      .insert({
        name,
        region,
        province: province || null,
        city: city || null,
        instagram_url: instagramUrl,
        whatsapp_number: whatsappNumber,
        image_url: image.image_url,
        image_path: image.image_path,
      })
      .select(RENTAL_COLUMNS)
      .single();

    if (error) {
      await removeImage(image.image_path);
      console.error("Rental insert error:", error);
      return json({ error: "Gagal menyimpan data rental." }, 500);
    }

    return json({ success: true, rental: data }, 201);
  } catch (error) {
    console.error("Rental POST error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan server.",
      },
      500
    );
  }
}

// PATCH: ubah data rental
export async function PATCH(request: NextRequest) {
  try {
    if (!validOrigin(request)) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    if (!(await requireAdmin(request))) {
      return json({ error: "Sesi admin tidak valid." }, 401);
    }

    const form = await request.formData();

    const id = String(form.get("id") || "").trim();
    const name = String(form.get("name") || "").trim();
    const region = String(form.get("region") || "").trim();
    const province = String(form.get("province") || "").trim();
    const city = String(form.get("city") || "").trim();
    const instagramUrl = String(form.get("instagram_url") || "").trim();

    if (
      !id ||
      !name ||
      name.length > 100 ||
      !region ||
      region.length > 120
    ) {
      return json(
        { error: "Data rental tidak lengkap atau tidak valid." },
        400
      );
    }

    if (province.length > 100 || city.length > 100) {
      return json(
        { error: "Provinsi dan kota maksimal 100 karakter." },
        400
      );
    }

    if (!validInstagramUrl(instagramUrl)) {
      return json(
        { error: "Link profil Instagram tidak valid." },
        400
      );
    }

    const supabase = getSupabaseAdmin();

    const { data: existing, error: findError } = await supabase
      .from("costume_rentals")
      .select(
        "id, image_path, whatsapp_number, subscription_expires_at, is_subscription"
      )
      .eq("id", id)
      .maybeSingle();

    if (findError || !existing) {
      return json({ error: "Data rental tidak ditemukan." }, 404);
    }

    const updates: Record<string, unknown> = {
      name,
      region,
      province: province || null,
      city: city || null,
      instagram_url: instagramUrl,
      updated_at: new Date().toISOString(),
    };

    const verifiedValue = form.get("is_verified");
    const subscriptionValue = form.get("is_subscription");

    if (
      verifiedValue !== null &&
      verifiedValue !== "true" &&
      verifiedValue !== "false"
    ) {
      return json(
        { error: "Status Partner Ship tidak valid." },
        400
      );
    }

    if (
      subscriptionValue !== null &&
      subscriptionValue !== "true" &&
      subscriptionValue !== "false"
    ) {
      return json(
        { error: "Status Subscription tidak valid." },
        400
      );
    }

    if (verifiedValue !== null) {
      updates.is_verified = verifiedValue === "true";
    }

    if (subscriptionValue !== null) {
      updates.is_subscription = subscriptionValue === "true";
    }

    const whatsappValue = form.get("whatsapp_number");

    if (whatsappValue !== null) {
      const whatsappNumber = normalizeWhatsapp(
        String(whatsappValue)
      );

      if (whatsappNumber === undefined) {
        return json(
          { error: "Nomor WhatsApp tidak valid. Gunakan 8–15 digit." },
          400
        );
      }

      updates.whatsapp_number = whatsappNumber;
    }

    const expiryValue = form.get("subscription_expires_at");

    if (expiryValue !== null) {
      const expiry = normalizeSubscriptionExpiry(
        String(expiryValue)
      );

      if (expiry === undefined) {
        return json(
          { error: "Tanggal kedaluwarsa Subscription tidak valid." },
          400
        );
      }

      updates.subscription_expires_at = expiry;
    }

    const finalSubscriptionStatus =
      subscriptionValue !== null
        ? subscriptionValue === "true"
        : existing.is_subscription === true;

    const finalExpiry =
      expiryValue !== null
        ? updates.subscription_expires_at
        : existing.subscription_expires_at;

    if (finalSubscriptionStatus && !finalExpiry) {
      return json(
        {
          error:
            "Tanggal kedaluwarsa wajib diisi sebelum mengaktifkan Subscription.",
        },
        400
      );
    }

    const file = form.get("image");
    let newImagePath: string | null = null;

    if (file instanceof File && file.size > 0) {
      const image = await uploadImage(file);
      newImagePath = image.image_path;
      updates.image_url = image.image_url;
      updates.image_path = image.image_path;
    }

    const { data, error } = await supabase
      .from("costume_rentals")
      .update(updates)
      .eq("id", id)
      .select(RENTAL_COLUMNS)
      .single();

    if (error) {
      if (newImagePath) {
        await removeImage(newImagePath);
      }

      console.error("Rental update error:", error);
      return json(
        { error: "Gagal memperbarui data rental." },
        500
      );
    }

    if (newImagePath && existing.image_path) {
      await removeImage(existing.image_path);
    }

    return json({ success: true, rental: data });
  } catch (error) {
    console.error("Rental PATCH error:", error);
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan server.",
      },
      500
    );
  }
}

// DELETE: hapus rental
export async function DELETE(request: NextRequest) {
  try {
    if (!validOrigin(request)) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    if (!(await requireAdmin(request))) {
      return json({ error: "Sesi admin tidak valid." }, 401);
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return json({ error: "ID rental tidak valid." }, 400);
    }

    const supabase = getSupabaseAdmin();

    const { data: existing, error: findError } = await supabase
      .from("costume_rentals")
      .select("id, image_path")
      .eq("id", id)
      .maybeSingle();

    if (findError || !existing) {
      return json({ error: "Data rental tidak ditemukan." }, 404);
    }

    const { error } = await supabase
      .from("costume_rentals")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Rental delete error:", error);
      return json(
        { error: "Gagal menghapus data rental." },
        500
      );
    }

    if (existing.image_path) {
      await removeImage(existing.image_path);
    }

    return json({ success: true });
  } catch (error) {
    console.error("Rental DELETE error:", error);
    return json(
      { error: "Terjadi kesalahan server." },
      500
    );
  }
}
