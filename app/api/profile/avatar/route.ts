import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "crypto";

export const runtime = "nodejs";

const COOKIE_NAME = "ngipen_session";
const BUCKET_NAME = "avatars";
const MAX_FILE_SIZE = 3 * 1024 * 1024;
const MAX_REQUEST_SIZE = MAX_FILE_SIZE + 64 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
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

function isValidImage(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

async function readRequestBodyWithinLimit(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return null;
    }
    if (parsedLength > MAX_REQUEST_SIZE) {
      return null;
    }
  }

  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.byteLength;
      if (totalSize > MAX_REQUEST_SIZE) {
        try {
          await reader.cancel();
        } catch {
          // The request is already being rejected; cancellation is best effort.
        }
        return null;
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get("origin") !== request.nextUrl.origin) {
      return json({ error: "Permintaan tidak diizinkan." }, 403);
    }

    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) return json({ error: "Sesi login tidak valid." }, 401);

    const supabase = getSupabaseAdmin();
    const { data: session, error: sessionError } = await supabase
      .from("ngipen_sessions")
      .select("user_id")
      .eq("token_hash", hashToken(token))
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (sessionError || !session) {
      return json({ error: "Sesi login tidak valid. Silakan login kembali." }, 401);
    }

    const contentType = request.headers.get("content-type") || "";
    if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) {
      return json({ error: "Format unggahan tidak valid." }, 400);
    }

    const requestBody = await readRequestBodyWithinLimit(request);
    if (!requestBody) {
      return json({ error: "Ukuran total permintaan avatar maksimal 3 MB." }, 413);
    }

    const formHeaders = new Headers({ "Content-Type": contentType });
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: formHeaders,
      body: new Blob([requestBody]),
    });
    const form = await boundedRequest.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return json({ error: "File avatar belum dipilih." }, 400);
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return json({ error: "Format avatar harus JPG, PNG, atau WebP." }, 400);
    }
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return json({ error: "Ukuran avatar maksimal 3 MB." }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length !== file.size || !isValidImage(buffer, file.type)) {
      return json({ error: "File avatar bukan gambar JPG, PNG, atau WebP yang valid." }, 400);
    }

    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = `users/${session.user_id}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, buffer, {
        upsert: false,
        cacheControl: "3600",
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Avatar upload failed.");
      return json({ error: "Gagal mengunggah avatar." }, 500);
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
    return json({ success: true, url: data.publicUrl });
  } catch {
    console.error("Profile avatar endpoint failed.");
    return json({ error: "Terjadi kesalahan pada server." }, 500);
  }
}
