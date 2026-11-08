import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_COOKIE_NAME = "ngipen_admin_session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETENTION_DAYS = 7;
const MAX_PREVIEW = 200;
type BucketName = "posters" | "documentations";
type StorageTarget = { bucket: BucketName; path: string; sources: string[] };

function json(data: object, status = 200) {
  const response = NextResponse.json(data, { status });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Konfigurasi Supabase server belum lengkap.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getAdminActor(request: NextRequest, supabase: ReturnType<typeof getSupabaseAdmin>) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("token_hash")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error("Gagal memeriksa sesi admin.");
  return data ? `admin_session:${tokenHash.slice(0, 16)}` : null;
}

function jakartaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function cutoffDate() {
  const today = jakartaDate();
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - RETENTION_DAYS);
  return date.toISOString().slice(0, 10);
}

function daysSinceEnd(endDate: string) {
  const end = new Date(`${endDate}T00:00:00.000Z`);
  const today = new Date(`${jakartaDate()}T00:00:00.000Z`);
  return Math.max(0, Math.floor((today.getTime() - end.getTime()) / 86_400_000));
}

function parseStorageUrl(rawUrl: string, expectedBucket?: BucketName): { bucket: BucketName; path: string } {
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(rawUrl);
    base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "");
  } catch {
    throw new Error("URL file tidak valid.");
  }
  if (parsed.origin !== base.origin) throw new Error("URL file bukan berasal dari project Supabase NGIPEN.");
  const prefix = "/storage/v1/object/public/";
  if (!parsed.pathname.startsWith(prefix)) throw new Error("URL file bukan URL public Storage yang didukung.");
  const encoded = parsed.pathname.slice(prefix.length).split("/");
  const bucket = decodeURIComponent(encoded.shift() || "") as BucketName;
  const path = encoded.map((part) => decodeURIComponent(part)).join("/");
  if ((bucket !== "posters" && bucket !== "documentations") || (expectedBucket && bucket !== expectedBucket)) {
    throw new Error("Bucket file tidak sesuai dengan jenis dokumentasinya.");
  }
  if (!path || path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Object path file tidak valid.");
  }
  return { bucket, path };
}

function addTarget(targets: Map<string, StorageTarget>, rawUrl: string | null | undefined, expectedBucket: BucketName, source: string) {
  if (!rawUrl) return;
  const parsed = parseStorageUrl(rawUrl, expectedBucket);
  const key = `${parsed.bucket}:${parsed.path}`;
  const existing = targets.get(key);
  if (existing) existing.sources.push(source);
  else targets.set(key, { ...parsed, sources: [source] });
}

async function objectInfo(supabase: ReturnType<typeof getSupabaseAdmin>, target: StorageTarget) {
  const slash = target.path.lastIndexOf("/");
  const directory = slash >= 0 ? target.path.slice(0, slash) : "";
  const fileName = slash >= 0 ? target.path.slice(slash + 1) : target.path;
  const { data, error } = await supabase.storage.from(target.bucket).list(directory, {
    search: fileName,
    limit: 100,
  });
  if (error) throw new Error(`Gagal memeriksa file Storage (${target.bucket}).`);
  const match = (data || []).find((item) => item.name === fileName);
  return match ? { exists: true, sizeBytes: Number(match.metadata?.size || 0) } : { exists: false, sizeBytes: 0 };
}

async function fetchAllEventRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: "event_documentations" | "documentations" | "event_moderation_logs",
  columns: string,
  eventId: string
) {
  const rows: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .eq("event_id", eventId)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error("Gagal membaca seluruh data terkait event.");
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function collectEventData(supabase: ReturnType<typeof getSupabaseAdmin>, eventId: string) {
  const [eventDocs, legacyDocs, moderationLogs, reviewsResult, savesResult, viewsResult] = await Promise.all([
    fetchAllEventRows(supabase, "event_documentations", "id, event_id, image_url, created_at", eventId),
    fetchAllEventRows(supabase, "documentations", "event_id, image_url, created_at", eventId),
    fetchAllEventRows(supabase, "event_moderation_logs", "id, admin_id, action, reason, created_at", eventId),
    supabase.from("event_reviews").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("event_saves").select("id", { count: "exact", head: true }).eq("event_id", eventId),
    supabase.from("event_views").select("id", { count: "exact", head: true }).eq("event_id", eventId),
  ]);
  const error = reviewsResult.error || savesResult.error || viewsResult.error;
  if (error) throw new Error("Gagal memeriksa relasi dan dokumentasi event. Tidak ada data yang dihapus.");

  const targets = new Map<string, StorageTarget>();
  eventDocs.forEach((doc: any) => addTarget(targets, doc.image_url, "documentations", `event_documentations:${doc.id}`));
  legacyDocs.forEach((doc: any, index: number) => addTarget(targets, doc.image_url, "documentations", `documentations:${eventId}:${index}`));
  return {
    eventDocs,
    legacyDocs,
    moderationLogs,
    counts: {
      eventDocumentations: eventDocs.length,
      legacyDocumentations: legacyDocs.length,
      reviews: reviewsResult.count || 0,
      saves: savesResult.count || 0,
      views: viewsResult.count || 0,
    },
    targets,
  };
}

async function collectReferences(supabase: ReturnType<typeof getSupabaseAdmin>, eventId: string) {
  const references = new Set<string>();
  const pageSize = 1000;
  const sources = [
    { table: "events", column: "poster_url", excludeColumn: "id" },
    { table: "event_documentations", column: "image_url", excludeColumn: "event_id" },
    { table: "documentations", column: "image_url", excludeColumn: "event_id" },
  ] as const;

  for (const source of sources) {
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(source.table)
        .select(`${source.column}, ${source.excludeColumn}`)
        // Include NULL legacy event_id rows: they may still reference the same Storage URL.
        .or(`${source.excludeColumn}.neq.${eventId},${source.excludeColumn}.is.null`)
        .range(from, from + pageSize - 1);
      if (error) throw new Error("Gagal memeriksa apakah file digunakan oleh event atau dokumentasi lain.");
      for (const row of data || []) {
        const raw = (row as any)[source.column];
        if (!raw || typeof raw !== "string") continue;
        try {
          const parsed = parseStorageUrl(raw);
          references.add(`${parsed.bucket}:${parsed.path}`);
        } catch {
          // URL eksternal/tidak didukung bukan objek dalam bucket yang akan dibersihkan.
        }
      }
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
  }
  return references;
}

async function getCandidate(supabase: ReturnType<typeof getSupabaseAdmin>, eventId: string) {
  const { data: event, error } = await supabase
    .from("events")
    .select("id, title, start_date, end_date, poster_url, moderation_status, is_sponsored, is_pinned")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw new Error("Gagal membaca event.");
  if (!event) return { event: null, details: null };
  if (!event.end_date || event.end_date > cutoffDate()) {
    throw new Error(`Event belum memenuhi masa tunggu ${RETENTION_DAYS} hari. Batas tanggal saat ini: ${cutoffDate()}.`);
  }
  const details = await collectEventData(supabase, eventId);
  addTarget(details.targets, event.poster_url, "posters", "poster");
  return { event, details };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!(await getAdminActor(request, supabase))) return json({ error: "Sesi admin tidak valid atau sudah berakhir." }, 401);

    const cutoff = cutoffDate();
    const { data: events, error } = await supabase
      .from("events")
      .select("id, title, start_date, end_date, poster_url, moderation_status, is_sponsored, is_pinned")
      .lte("end_date", cutoff)
      .order("end_date", { ascending: true })
      .limit(MAX_PREVIEW);
    if (error) throw new Error("Gagal mengambil daftar event kandidat.");

    const candidates = [];
    for (const event of events || []) {
      const details = await collectEventData(supabase, String(event.id));
      const targets = new Map(details.targets);
      addTarget(targets, event.poster_url, "posters", "poster");
      let totalBytes = 0;
      let presentFiles = 0;
      let missingFiles = 0;
      const targetList: StorageTarget[] = [];
      targets.forEach((target) => targetList.push(target));
      for (let index = 0; index < targetList.length; index += 1) {
        const target = targetList[index];
        const info = await objectInfo(supabase, target);
        if (info.exists) { presentFiles += 1; totalBytes += info.sizeBytes; }
        else missingFiles += 1;
      }
      candidates.push({
        ...event,
        daysSinceEnd: daysSinceEnd(String(event.end_date)),
        documentationCount: details.counts.eventDocumentations + details.counts.legacyDocumentations,
        eventDocumentationCount: details.counts.eventDocumentations,
        legacyDocumentationCount: details.counts.legacyDocumentations,
        reviewCount: details.counts.reviews,
        saveCount: details.counts.saves,
        viewCount: details.counts.views,
        storageFileCount: targets.size,
        storagePresentCount: presentFiles,
        storageMissingCount: missingFiles,
        storageBytes: totalBytes,
      });
    }

    const { data: history, error: historyError } = await supabase
      .from("event_cleanup_audit")
      .select("id, event_id, event_title, status, error_message, created_at, completed_at, deleted_file_count")
      .order("created_at", { ascending: false })
      .limit(40);
    if (historyError) throw new Error("Tabel audit Event Cleanup belum tersedia. Terapkan migration Event Cleanup terlebih dahulu.");

    return json({ success: true, cutoffDate: cutoff, retentionDays: RETENTION_DAYS, candidates, history: history || [] });
  } catch (error) {
    console.error("Event cleanup preview error:", error);
    return json({ error: error instanceof Error ? error.message : "Gagal memuat Event Cleanup." }, 500);
  }
}

export async function POST(request: NextRequest) {
  let supabase: ReturnType<typeof getSupabaseAdmin> | null = null;
  let auditId: string | null = null;
  let claimToken: string | null = null;
  try {
    const origin = request.headers.get("origin");
    if (!origin || origin !== request.nextUrl.origin) return json({ error: "Origin request tidak valid." }, 403);

    supabase = getSupabaseAdmin();
    const adminActor = await getAdminActor(request, supabase);
    if (!adminActor) return json({ error: "Sesi admin tidak valid atau sudah berakhir." }, 401);

    let body: { id?: unknown; confirm?: unknown; confirmSponsored?: unknown };
    try { body = await request.json(); } catch { return json({ error: "Format request tidak valid." }, 400); }
    if (typeof body.id !== "string" || !UUID_PATTERN.test(body.id) || body.confirm !== true) {
      return json({ error: "ID event atau konfirmasi penghapusan tidak valid." }, 400);
    }

    const { event, details } = await getCandidate(supabase, body.id);
    if (!event || !details) return json({ error: "Event tidak ditemukan." }, 404);
    if ((event.is_sponsored || event.is_pinned) && body.confirmSponsored !== true) {
      return json({ error: "Event masih sponsored atau pinned. Konfirmasi khusus diperlukan sebelum penghapusan." }, 409);
    }

    const references = await collectReferences(supabase, body.id);
    const sharedTargets: string[] = [];
    const removableTargets: StorageTarget[] = [];
    const detailTargets: StorageTarget[] = [];
    details.targets.forEach((target) => detailTargets.push(target));
    for (let index = 0; index < detailTargets.length; index += 1) {
      const target = detailTargets[index];
      const key = `${target.bucket}:${target.path}`;
      if (references.has(key)) sharedTargets.push(key);
      else removableTargets.push(target);
    }

    const fileManifest = [];
    for (const target of removableTargets) {
      const info = await objectInfo(supabase, target);
      fileManifest.push({ bucket: target.bucket, path: target.path, sources: target.sources, existsBeforeDelete: info.exists, sizeBytes: info.sizeBytes });
    }

    // If a previous request stopped after Storage succeeded, resume its audit
    // instead of creating a second active cleanup for the same event.
    const { data: activeAudit, error: activeAuditError } = await supabase
      .from("event_cleanup_audit")
      .select("id, status, created_at, deleted_storage_paths, already_missing_paths, processing_token, processing_started_at")
      .eq("event_id", event.id)
      .in("status", ["pending", "storage_deleted", "failed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activeAuditError) throw new Error("Gagal memeriksa proses cleanup sebelumnya.");

    let previousDeletedPaths: string[] = [];
    let previousMissingPaths: string[] = [];
    if (activeAudit) {
      const leaseAge = activeAudit.processing_started_at
        ? Date.now() - new Date(activeAudit.processing_started_at).getTime()
        : Number.POSITIVE_INFINITY;
      if (activeAudit.processing_token && leaseAge < 30 * 60 * 1000) {
        return json({ error: "Event ini sedang diproses oleh permintaan cleanup lain. Periksa kembali beberapa saat lagi." }, 409);
      }
      auditId = activeAudit.id;
      previousDeletedPaths = Array.isArray(activeAudit.deleted_storage_paths) ? activeAudit.deleted_storage_paths : [];
      previousMissingPaths = Array.isArray(activeAudit.already_missing_paths) ? activeAudit.already_missing_paths : [];
    }

    if (!auditId) {
      const { data: audit, error: auditError } = await supabase
        .from("event_cleanup_audit")
        .insert({
          event_id: event.id,
          event_title: event.title,
          event_start_date: event.start_date,
          event_end_date: event.end_date,
          admin_actor: adminActor,
          special_status_confirmed: body.confirmSponsored === true,
          status: "pending",
          file_manifest: fileManifest,
          preserved_shared_paths: sharedTargets,
          moderation_snapshot: details.moderationLogs,
          record_counts: details.counts,
        })
        .select("id")
        .single();
      if (auditError?.code === "23505") {
        return json({ error: "Event ini sedang diproses oleh permintaan cleanup lain. Periksa kembali beberapa saat lagi." }, 409);
      }
      if (auditError || !audit) throw new Error("Gagal membuat audit cleanup. Tidak ada file atau record yang dihapus.");
      auditId = audit.id;
    }

    claimToken = crypto.randomUUID();
    const { data: claimed, error: claimError } = await supabase.rpc("claim_event_cleanup", {
      p_event_id: event.id,
      p_audit_id: auditId,
      p_claim_token: claimToken,
    });
    if (claimError) throw new Error("Gagal mengunci proses cleanup. Pastikan migration checkpoint sudah diterapkan pada database pengujian.");
    if (claimed !== true) return json({ error: "Event sedang diproses oleh admin lain. Coba lagi setelah proses sebelumnya selesai." }, 409);

    const buckets: BucketName[] = ["posters", "documentations"];
    const alreadyMissing: string[] = [...previousMissingPaths];
    const deletedPaths: string[] = [...previousDeletedPaths];
    const checkpoint = async () => {
      const { data, error } = await supabase
        .from("event_cleanup_audit")
        .update({
          deleted_storage_paths: Array.from(new Set(deletedPaths)),
          already_missing_paths: Array.from(new Set(alreadyMissing.filter((path) => !deletedPaths.includes(path)))),
          deleted_file_count: new Set(deletedPaths).size,
          processing_started_at: new Date().toISOString(),
        })
        .eq("id", auditId)
        .eq("processing_token", claimToken)
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("Gagal menyimpan checkpoint Storage. Event database tetap dipertahankan.");
    };
    for (const bucket of buckets) {
      const targets = removableTargets.filter((target) => target.bucket === bucket);
      for (let offset = 0; offset < targets.length; offset += 100) {
        const batch = targets.slice(offset, offset + 100);
        const existing: string[] = [];
        for (const target of batch) {
          const key = `${target.bucket}:${target.path}`;
          if (deletedPaths.includes(key) || alreadyMissing.includes(key)) continue;
          const info = await objectInfo(supabase, target);
          if (info.exists) existing.push(target.path);
          else alreadyMissing.push(key);
        }
        if (existing.length) {
          const { error: removeError } = await supabase.storage.from(bucket).remove(existing);
          if (removeError) throw new Error(`Gagal menghapus file pada bucket ${bucket}. Database event tetap dipertahankan.`);
          deletedPaths.push(...existing.map((path) => `${bucket}:${path}`));
        }
        // Persist every successful batch and lease heartbeat before proceeding.
        await checkpoint();
      }
    }

    const { error: storageAuditError } = await supabase
      .from("event_cleanup_audit")
      .update({
        status: "storage_deleted",
        deleted_storage_paths: Array.from(new Set(deletedPaths)),
        already_missing_paths: Array.from(new Set(alreadyMissing.filter((path) => !deletedPaths.includes(path)))),
        deleted_file_count: new Set(deletedPaths).size,
        storage_deleted_at: new Date().toISOString(),
        processing_token: null,
        processing_started_at: null,
      })
      .eq("id", auditId)
      .eq("processing_token", claimToken);
    if (storageAuditError) throw new Error("File Storage telah diproses, tetapi pembaruan audit gagal. Event database belum dihapus.");

    const { error: finalizeError } = await supabase.rpc("finalize_event_cleanup", {
      p_event_id: event.id,
      p_audit_id: auditId,
    });
    if (finalizeError) throw new Error("File Storage sudah diproses, tetapi penghapusan database gagal. Proses tercatat dan perlu dicoba ulang.");

    return json({
      success: true,
      auditId,
      eventId: event.id,
      deletedFileCount: deletedPaths.length,
      alreadyMissingCount: alreadyMissing.filter((path) => !deletedPaths.includes(path)).length,
      preservedSharedCount: sharedTargets.length,
      deletedRecordCounts: details.counts,
      message: "Event, poster, dan dokumentasi terkait berhasil dibersihkan.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan pada server.";
    if (supabase && auditId && claimToken) {
      // Preserve all persisted checkpoints; release the lease for a safe retry.
      await supabase.from("event_cleanup_audit")
        .update({ status: "failed", error_message: message, processing_token: null, processing_started_at: null })
        .eq("id", auditId)
        .eq("processing_token", claimToken)
        .in("status", ["pending", "storage_deleted"]);
    }
    console.error("Event cleanup execution error:", error);
    return json({ error: message }, 500);
  }
}

