
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_admin_session";
const BUCKET = "costume-rentals";
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

function getImageExtension(type: string) {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return null;
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

  const { error } = await getSupabaseAdmin()
    .storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error("Gagal mengunggah foto rental.");

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

// GET: daftar rental untuk publik dan admin
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("costume_rentals")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Rental list error:", error);
      return json({ error: "Gagal mengambil daftar rental." }, 500);
    }

    return json({ rentals: data || [] });
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
    const instagramUrl = String(form.get("instagram_url") || "").trim();
    const file = form.get("image");

    if (!name || name.length > 100) {
      return json({ error: "Nama rental wajib diisi (maksimal 100 karakter)." }, 400);
    }

    if (!region || region.length > 120) {
      return json({ error: "Daerah rental wajib diisi (maksimal 120 karakter)." }, 400);
    }

    if (!validInstagramUrl(instagramUrl)) {
      return json({ error: "Masukkan link profil Instagram yang valid." }, 400);
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
        instagram_url: instagramUrl,
        image_url: image.image_url,
        image_path: image.image_path,
      })
      .select()
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
      { error: error instanceof Error ? error.message : "Terjadi kesalahan server." },
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
    const instagramUrl = String(form.get("instagram_url") || "").trim();

    if (!id || !name || name.length > 100 || !region || region.length > 120) {
      return json({ error: "Data rental tidak lengkap atau tidak valid." }, 400);
    }

    if (!validInstagramUrl(instagramUrl)) {
      return json({ error: "Link profil Instagram tidak valid." }, 400);
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

    const updates: Record<string, unknown> = {
      name,
      region,
      instagram_url: instagramUrl,
      updated_at: new Date().toISOString(),
    };

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
      .select()
      .single();

    if (error) {
      if (newImagePath) await removeImage(newImagePath);
      console.error("Rental update error:", error);
      return json({ error: "Gagal memperbarui data rental." }, 500);
    }

    if (newImagePath && existing.image_path) {
      await removeImage(existing.image_path);
    }

    return json({ success: true, rental: data });
  } catch (error) {
    console.error("Rental PATCH error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan server." },
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
      return json({ error: "Gagal menghapus data rental." }, 500);
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
