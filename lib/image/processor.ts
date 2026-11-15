import sharp from "sharp";
import { validateImage } from "./validation";
import type { ImagePreset, ImagePresetName, ImageProcessingOptions, ProcessedImage } from "./types";

export const IMAGE_PRESETS: Record<ImagePresetName, ImagePreset> = {
  poster: { width: 600, height: 600, fit: "inside", withoutEnlargement: true, quality: 82 },
  rental: { width: 500, height: 500, fit: "inside", withoutEnlargement: true, quality: 82 },
  avatar: { width: 256, height: 256, fit: "cover", position: "centre", withoutEnlargement: true, quality: 82 },
  documentation: { width: 600, height: 600, fit: "inside", withoutEnlargement: true, quality: 82 },
};

export async function processImage(
  input: Buffer | Uint8Array,
  presetName: ImagePresetName,
  options: ImageProcessingOptions = {},
): Promise<ProcessedImage> {
  const validated = await validateImage(input, {
    maxBytes: options.maxBytes,
    maxPixels: options.maxPixels,
    declaredMimeType: options.declaredMimeType,
  });
  const preset = IMAGE_PRESETS[presetName];
  const result = await sharp(validated.buffer, { limitInputPixels: options.maxPixels ?? 40_000_000 })
    .rotate()
    .resize({
      width: preset.width,
      height: preset.height,
      fit: preset.fit,
      position: preset.position,
      withoutEnlargement: preset.withoutEnlargement,
    })
    .webp({ quality: options.quality ?? preset.quality, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    contentType: "image/webp",
    extension: "webp",
    width: result.info.width,
    height: result.info.height,
    size: result.data.length,
  };
}
