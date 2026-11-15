import type { ImageStorageAdapter, ProcessedImage } from "./types";

/**
 * Builds deterministic object paths for a future storage adapter.
 * This module intentionally performs no network or Supabase operations in PHASE 1A.
 */
export function createImageStoragePlan(input: {
  originalPath: string;
  thumbnailPath?: string;
  thumbnail: ProcessedImage;
}) {
  const thumbnailPath = input.thumbnailPath ?? input.originalPath.replace(/\.[^.\/]+$/, "") + ".thumb.webp";
  return {
    originalPath: input.originalPath,
    thumbnailPath,
    thumbnailContentType: input.thumbnail.contentType,
  } as const;
}

/** Contract only; concrete storage integration is deferred to a later approved phase. */
export type { ImageStorageAdapter };
