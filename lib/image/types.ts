import type { Metadata } from "sharp";

export type SupportedImageFormat = "jpeg" | "png" | "webp";
export type ImagePresetName = "poster" | "rental" | "avatar" | "documentation";

export interface ImagePreset {
  width: number;
  height: number;
  fit: "inside" | "cover";
  position?: "centre";
  withoutEnlargement: boolean;
  quality: number;
}

export interface ImageValidationOptions {
  maxBytes?: number;
  maxPixels?: number;
  declaredMimeType?: string;
}

export interface ValidatedImage {
  buffer: Buffer;
  format: SupportedImageFormat;
  mimeType: string;
  width: number;
  height: number;
  size: number;
  metadata: Metadata;
}

export interface ImageProcessingOptions {
  maxBytes?: number;
  maxPixels?: number;
  declaredMimeType?: string;
  quality?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  contentType: "image/webp";
  extension: "webp";
  width: number;
  height: number;
  size: number;
}

export interface ImageStorageAdapter {
  uploadOriginal(input: { path: string; buffer: Buffer; contentType: string }): Promise<string>;
  uploadThumbnail(input: { path: string; buffer: Buffer; contentType: "image/webp" }): Promise<string>;
}
