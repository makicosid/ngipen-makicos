import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const APPLY = process.argv.includes("--apply");
const PAGE_SIZE = 500;
const OUTPUT_DIR = "migration-output";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia di environment lokal.");
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SOURCES = [
  { table: "events", column: "poster_url", bucket: "posters", label: "poster", maxWidth: 1400, maxHeight: 1800 },
  { table: "users", column: "avatar_url", bucket: "avatars", label: "avatar", maxWidth: 512, maxHeight: 512 },
  { table: "costume_rentals", column: "image_url", pathColumn: "image_path", bucket: "costume-rentals", label: "rental", maxWidth: 1200, maxHeight: 1200 },
  { table: "event_documentations", column: "image_url", bucket: "documentations", label: "documentation", maxWidth: 1400, maxHeight: 1400 },
  { table: "documentations", column: "image_url", bucket: "documentations", label: "legacy-documentation", maxWidth: 1400, maxHeight: 1400 },
  { table: "ad_campaigns", column: "image_path", bucket: "ad-assets", label: "ad-asset", pathOnly: true, maxWidth: 1600, maxHeight: 900 },
];

function parseStoragePath(url, expectedBucket) {
  if (!url) return null;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  const marker = `/storage/v1/object/public/${expectedBucket}/`;
  const index = parsed.pathname.indexOf(marker);
  if (index < 0) return null;
  const encoded = parsed.pathname.slice(index + marker.length);
  if (!encoded) return null;
  try { return decodeURIComponent(encoded); } catch { return null; }
}

async function readRows(source) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const selectColumns = source.pathColumn
      ? `id,${source.column},${source.pathColumn}`
      : `id,${source.column}`;
    const { data, error } = await supabase
      .from(source.table)
      .select(selectColumns)
      .not(source.column, "is", null)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Gagal membaca ${source.table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

function makeWebpPath(oldPath) {
  const slash = oldPath.lastIndexOf("/");
  const directory = slash >= 0 ? oldPath.slice(0, slash + 1) : "";
  const filename = slash >= 0 ? oldPath.slice(slash + 1) : oldPath;
  const stem = filename.replace(/\.[^.]+$/, "");
  return `${directory}${stem}.webp`;
}

async function saveManifest(manifest, suffix) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(OUTPUT_DIR, `webp-migration-${stamp}-${suffix}.json`);
  await writeFile(file, JSON.stringify(manifest, null, 2), "utf8");
  return file;
}

async function main() {
  const plans = [];
  for (const source of SOURCES) {
    const rows = await readRows(source);
    for (const row of rows) {
      const oldUrl = row[source.column];
      const oldPath = source.pathOnly ? oldUrl : parseStoragePath(oldUrl, source.bucket);
      if (typeof oldPath !== "string" || !oldPath) continue;
      plans.push({ source, row, oldUrl, oldPath });
    }
  }

  const grouped = new Map();
  for (const plan of plans) {
    const key = `${plan.source.bucket}/${plan.oldPath}`;
    const existing = grouped.get(key);
    if (existing) existing.references.push(plan);
    else grouped.set(key, { bucket: plan.source.bucket, oldPath: plan.oldPath, references: [plan] });
  }

  const summary = {
    mode: APPLY ? "APPLY" : "DRY-RUN",
    scannedReferences: plans.length,
    uniqueStorageFiles: grouped.size,
    skippedAlreadyWebp: [...grouped.values()].filter(item => /\.webp$/i.test(item.oldPath)).length,
    byBucket: {},
  };
  for (const plan of plans) summary.byBucket[plan.source.bucket] = (summary.byBucket[plan.source.bucket] || 0) + 1;

  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) {
    console.log("\nDRY-RUN: belum ada file Storage atau database yang diubah.");
    console.log("Jika ringkasan sudah benar, jalankan ulang dengan --apply.");
    return;
  }

  const manifest = {
    startedAt: new Date().toISOString(),
    sourceProject: new URL(SUPABASE_URL).host,
    note: "File sumber tidak dihapus. Simpan manifest ini sebagai catatan pemulihan.",
    results: [],
  };
  const uploaded = new Map();

  for (const item of grouped.values()) {
    if (/\.webp$/i.test(item.oldPath)) {
      for (const ref of item.references) {
        manifest.results.push({ table: ref.source.table, id: ref.row.id, bucket: item.bucket, oldPath: item.oldPath, oldUrl: ref.oldUrl, status: "already-webp" });
      }
      continue;
    }

    const newPath = makeWebpPath(item.oldPath);
    const key = `${item.bucket}/${item.oldPath}`;
    let newUrl = uploaded.get(key);
    let originalBytes = 0;
    let convertedBytes = 0;

    if (!newUrl) {
      const storage = supabase.storage.from(item.bucket);
      const { data: file, error: downloadError } = await storage.download(item.oldPath);
      if (downloadError || !file) {
        const message = downloadError?.message || "File download returned empty result";
        manifest.results.push({ bucket: item.bucket, oldPath: item.oldPath, status: "download-failed", error: message });
        console.error(`[FAIL download] ${item.bucket}/${item.oldPath}: ${message}`);
        continue;
      }

      const input = Buffer.from(await file.arrayBuffer());
      originalBytes = input.length;
      let output;
      try {
        output = await sharp(input, { failOn: "error", limitInputPixels: 100_000_000 })
          .rotate()
          .resize({
            width: item.references[0].source.maxWidth,
            height: item.references[0].source.maxHeight,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 80, effort: 5, smartSubsample: true })
          .toBuffer();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        manifest.results.push({ bucket: item.bucket, oldPath: item.oldPath, status: "conversion-failed", error: message });
        console.error(`[FAIL convert] ${item.bucket}/${item.oldPath}: ${message}`);
        continue;
      }

      convertedBytes = output.length;
      const { error: uploadError } = await storage.upload(newPath, output, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });

      if (uploadError) {
        // Make reruns safe: a prior run may have uploaded WebP but stopped before DB update.
        const { data: existingFile, error: existingError } = await storage.download(newPath);
        let existingIsWebp = false;
        if (!existingError && existingFile) {
          try {
            const metadata = await sharp(Buffer.from(await existingFile.arrayBuffer())).metadata();
            existingIsWebp = metadata.format === "webp";
          } catch {
            existingIsWebp = false;
          }
        }
        if (!existingIsWebp) {
          const message = uploadError.message;
          manifest.results.push({ bucket: item.bucket, oldPath: item.oldPath, newPath, status: "upload-failed", error: message });
          console.error(`[FAIL upload] ${item.bucket}/${newPath}: ${message}`);
          continue;
        }
        console.log(`[REUSE] Existing WebP found at ${item.bucket}/${newPath}`);
      }

      if (item.references[0].source.pathOnly) {
        newUrl = newPath;
      } else {
        const { data: publicData } = storage.getPublicUrl(newPath);
        newUrl = publicData.publicUrl;
      }
      uploaded.set(key, newUrl);
    }

    for (const ref of item.references) {
      const patch = { [ref.source.column]: newUrl };
      if (ref.source.pathColumn) patch[ref.source.pathColumn] = newPath;
      let updateQuery = supabase
        .from(ref.source.table)
        .update(patch)
        .eq("id", ref.row.id)
        .eq(ref.source.column, ref.oldUrl);
      if (ref.source.pathColumn) {
        updateQuery = updateQuery.eq(ref.source.pathColumn, ref.row[ref.source.pathColumn]);
      }
      const { data: updatedRows, error: updateError } = await updateQuery.select("id");

      if (updateError || !updatedRows || updatedRows.length !== 1) {
        manifest.results.push({
          table: ref.source.table, id: ref.row.id, bucket: item.bucket,
          oldPath: item.oldPath, newPath, oldUrl: ref.oldUrl, newUrl,
          status: "database-update-failed", error: updateError?.message || "Record berubah sejak proses migrasi dimulai; URL lama tidak ditimpa.",
        });
        console.error(`[FAIL database] ${ref.source.table} id=${ref.row.id}: ${updateError?.message || "record changed concurrently"}`);
        continue;
      }

      const result = {
        table: ref.source.table, id: ref.row.id, bucket: item.bucket,
        oldPath: item.oldPath, newPath, oldUrl: ref.oldUrl, newUrl,
        originalBytes, convertedBytes,
        savedPercent: originalBytes ? Number(((1 - convertedBytes / originalBytes) * 100).toFixed(1)) : null,
        status: "migrated",
      };
      manifest.results.push(result);
      console.log(`[OK] ${item.bucket}/${item.oldPath} -> ${newPath} (${result.savedPercent}% smaller)`);
    }

    await saveManifest(manifest, "checkpoint");
  }

  manifest.finishedAt = new Date().toISOString();
  const migrated = manifest.results.filter(item => item.status === "migrated").length;
  const failed = manifest.results.filter(item => item.status.endsWith("failed")).length;
  manifest.summary = { migratedReferences: migrated, failures: failed, untouchedOriginals: true };
  const manifestPath = await saveManifest(manifest, "final");
  console.log("\nMIGRATION FINISHED");
  console.log(JSON.stringify(manifest.summary, null, 2));
  console.log(`Manifest: ${manifestPath}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
