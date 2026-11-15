import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { adminJson, getSupabaseAdmin, isSameOrigin, requireAdmin } from "../../../../../lib/server/advertising";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return adminJson({ error: "Permintaan tidak diizinkan." }, 403);
    const supabase = await requireAdmin(request);
    if (!supabase) return adminJson({ error: "Sesi admin tidak valid." }, 401);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_SIZE + 64 * 1024) return adminJson({ error: "Ukuran file maksimal 5 MB." }, 413);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return adminJson({ error: "File gambar wajib dipilih." }, 400);
    if (!ALLOWED_TYPES.has(file.type)) return adminJson({ error: "Format gambar harus JPG, PNG, WEBP, atau AVIF." }, 400);
    if (file.size < 1 || file.size > MAX_FILE_SIZE) return adminJson({ error: "Ukuran gambar maksimal 5 MB." }, 400);

    const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const startsWith = (...bytes: number[]) => bytes.every((byte, index) => signature[index] === byte);
    const isJpeg = startsWith(0xff, 0xd8, 0xff);
    const isPng = startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    const isWebp = startsWith(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...signature.slice(8, 12)) === "WEBP";
    const isAvif = String.fromCharCode(...signature.slice(4, 12)).startsWith("ftypavif") || String.fromCharCode(...signature.slice(4, 12)).startsWith("ftypavis");
    const signatureMatches = file.type === "image/jpeg" ? isJpeg : file.type === "image/png" ? isPng : file.type === "image/webp" ? isWebp : isAvif;
    if (!signatureMatches) return adminJson({ error: "Isi file tidak sesuai dengan format gambar yang dipilih." }, 400);

    const extension = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" } as Record<string, string>)[file.type];
    const path = `campaigns/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from("ad-assets").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) {
      console.error("Advertising image upload failed:", error.message);
      return adminJson({ error: "Gagal mengunggah gambar iklan." }, 500);
    }
    const { data } = supabase.storage.from("ad-assets").getPublicUrl(path);
    return adminJson({ success: true, path, publicUrl: data.publicUrl }, 201);
  } catch (error) {
    console.error("Advertising upload failed:", error);
    return adminJson({ error: "Terjadi kesalahan saat mengunggah gambar." }, 500);
  }
}
