import { randomUUID } from "crypto";
import { processImage } from "./processor";
import { validateImage, ImageValidationError } from "./validation";
import type { ImagePresetName } from "./types";

type StorageBucket = {
  upload(path: string, body: Buffer, options: { contentType: string; cacheControl: string; upsert: boolean }): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
};

export async function readBoundedFormData(request: Request, maxBytes: number): Promise<FormData | null> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) return null;
  const length = request.headers.get("content-length");
  if (length !== null) {
    const parsed = Number(length);
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maxBytes) return null;
  }
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(new Blob([body]), { headers: { "Content-Type": contentType } }).formData();
}

export async function uploadOptimizedImage(input: {
  bucket: StorageBucket; buffer: Buffer; mimeType: string; preset: ImagePresetName;
  maxBytes: number; pathPrefix: string; cacheControl?: string;
}) {
  const validated = await validateImage(input.buffer, {
    maxBytes: input.maxBytes, maxPixels: 40_000_000, declaredMimeType: input.mimeType,
  });
  const optimized = await processImage(validated.buffer, input.preset, {
    maxBytes: input.maxBytes, maxPixels: 40_000_000, declaredMimeType: input.mimeType,
  });
  const originalPath = `${input.pathPrefix}/${randomUUID()}.${validated.format === "jpeg" ? "jpg" : validated.format}`;
  const thumbnailPath = `${originalPath}.thumb.webp`;
  const cacheControl = input.cacheControl ?? "3600";
  const original = await input.bucket.upload(originalPath, validated.buffer, {
    contentType: validated.mimeType, cacheControl, upsert: false,
  });
  if (original.error) throw new Error("Gagal mengunggah file gambar asli.");
  const thumbnail = await input.bucket.upload(thumbnailPath, optimized.buffer, {
    contentType: "image/webp", cacheControl, upsert: false,
  });
  if (thumbnail.error) throw new Error("Gagal mengunggah thumbnail WebP.");
  return {
    originalPath, thumbnailPath,
    originalUrl: input.bucket.getPublicUrl(originalPath).data.publicUrl,
    thumbnailUrl: input.bucket.getPublicUrl(thumbnailPath).data.publicUrl,
    width: optimized.width, height: optimized.height, size: optimized.size,
  };
}

export async function removeImageThumbnail(bucket: StorageBucket, originalPath: string) {
  if (!originalPath) return;
  const thumbnailPath = originalPath.endsWith(".thumb.webp") ? originalPath : `${originalPath}.thumb.webp`;
  const { error } = await bucket.remove([thumbnailPath]);
  if (error) console.error("Image thumbnail cleanup error:", error.message);
}
export { ImageValidationError };
