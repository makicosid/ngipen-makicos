import sharp, { type Metadata } from "sharp";
import type { ImageValidationOptions, SupportedImageFormat, ValidatedImage } from "./types";

export type ImageValidationErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "MIME_MISMATCH"
  | "INVALID_IMAGE"
  | "IMAGE_TOO_LARGE"
  | "ANIMATED_IMAGE";

export class ImageValidationError extends Error {
  constructor(public readonly code: ImageValidationErrorCode, message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_PIXELS = 40_000_000;

function detectFormat(buffer: Buffer): { format: SupportedImageFormat; mimeType: string } {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { format: "jpeg", mimeType: "image/jpeg" };
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { format: "png", mimeType: "image/png" };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return { format: "webp", mimeType: "image/webp" };
  }
  throw new ImageValidationError("UNSUPPORTED_FORMAT", "Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP.");
}

function isPixelLimitError(error: unknown): boolean {
  return error instanceof Error && /pixel limit|exceeds.*limit|too large/i.test(error.message);
}

export async function validateImage(
  input: Buffer | Uint8Array,
  options: ImageValidationOptions = {},
): Promise<ValidatedImage> {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buffer.length === 0) {
    throw new ImageValidationError("EMPTY_FILE", "File gambar kosong.");
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
  if (buffer.length > maxBytes) {
    throw new ImageValidationError("FILE_TOO_LARGE", `Ukuran gambar melebihi batas ${maxBytes} byte.`);
  }

  const detected = detectFormat(buffer);
  if (options.declaredMimeType !== undefined && options.declaredMimeType !== detected.mimeType) {
    throw new ImageValidationError("MIME_MISMATCH", "Tipe file tidak sesuai dengan isi gambar.");
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: maxPixels, animated: true }).metadata();
  } catch (error) {
    if (isPixelLimitError(error)) {
      throw new ImageValidationError("IMAGE_TOO_LARGE", "Dimensi gambar melebihi batas pemrosesan.");
    }
    throw new ImageValidationError("INVALID_IMAGE", "File tidak dapat dibaca sebagai gambar yang valid.");
  }

  if (!metadata.width || !metadata.height) {
    throw new ImageValidationError("INVALID_IMAGE", "Dimensi gambar tidak valid.");
  }
  if (metadata.width * metadata.height > maxPixels) {
    throw new ImageValidationError("IMAGE_TOO_LARGE", "Dimensi gambar melebihi batas pemrosesan.");
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new ImageValidationError("ANIMATED_IMAGE", "Gambar animasi belum didukung untuk thumbnail.");
  }

  return {
    buffer,
    format: detected.format,
    mimeType: detected.mimeType,
    width: metadata.width,
    height: metadata.height,
    size: buffer.length,
    metadata,
  };
}
