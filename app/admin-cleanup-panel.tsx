"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CleanupCandidate = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string;
  poster_url: string | null;
  moderation_status: string | null;
  is_sponsored: boolean;
  is_pinned: boolean;
  daysSinceEnd: number;
  documentationCount: number;
  eventDocumentationCount: number;
  legacyDocumentationCount: number;
  reviewCount: number;
  saveCount: number;
  viewCount: number;
  storageFileCount: number;
  storagePresentCount: number;
  storageMissingCount: number;
  storageBytes: number;
};

type CleanupHistory = {
  id: string;
  event_id: string;
  event_title: string;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  deleted_file_count: number;
};

const numberFormat = new Intl.NumberFormat("id-ID");
const dateFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" });

function formatBytes(bytes: number) {
  if (!bytes) return "0 byte";
  const units = ["byte", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toLocaleString("id-ID", { maximumFractionDigits: 2 })} ${units[index]}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date);
}

function PosterPreview({ src, title }: { src: string | null; title: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 px-1 text-center text-[10px] text-gray-400 dark:bg-gray-800">
        Poster tidak tersedia
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`Poster ${title}`}
      onError={() => setFailed(true)}
      className="h-24 w-16 shrink-0 rounded-lg border object-cover"
    />
  );
}

export default function AdminCleanupPanel({ onCleanupComplete }: { onCleanupComplete?: (eventId: string) => void }) {
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [history, setHistory] = useState<CleanupHistory[]>([]);
  const [cutoffDate, setCutoffDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<"candidates" | "history" | "failed">("candidates");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/events/cleanup", { method: "GET", credentials: "include", cache: "no-store" });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error || "Gagal memuat kandidat cleanup.");
      setCandidates(Array.isArray(result.candidates) ? result.candidates : []);
      setHistory(Array.isArray(result.history) ? result.history : []);
      setCutoffDate(String(result.cutoffDate || ""));
      setSelectedIds([]);
      setAcknowledgedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat Event Cleanup.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const failedHistory = useMemo(() => history.filter((item) => item.status === "failed" || item.status === "storage_deleted" || item.status === "pending"), [history]);
  const selectedCandidates = useMemo(() => candidates.filter((item) => selectedIds.includes(item.id)), [candidates, selectedIds]);
  const selectedNeedsAcknowledgement = selectedCandidates.some((item) => (item.is_sponsored || item.is_pinned) && !acknowledgedIds.includes(item.id));

  const executeCleanup = async () => {
    if (!selectedCandidates.length || selectedNeedsAcknowledgement || busyIds.length) return;
    const sponsoredCount = selectedCandidates.filter((item) => item.is_sponsored || item.is_pinned).length;
    const message = [
      `Kamu akan menghapus permanen ${selectedCandidates.length} event.`,
      "Poster dan seluruh foto dokumentasi terkait akan dihapus dari Supabase Storage.",
      "Record dokumentasi, ulasan, saves, views, dan event akan dihapus; snapshot riwayat moderasi dan audit cleanup dipertahankan.",
      sponsoredCount ? `${sponsoredCount} event masih berstatus sponsored/pinned dan sudah kamu konfirmasi.` : "",
      "Tindakan ini tidak dapat dibatalkan. Lanjutkan?",
    ].filter(Boolean).join("\n\n");
    if (!window.confirm(message)) return;

    setBusyIds(selectedCandidates.map((item) => item.id));
    setNotice("");
    setError("");
    let completed = 0;
    const failures: string[] = [];
    for (const candidate of selectedCandidates) {
      try {
        const response = await fetch("/api/admin/events/cleanup", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: candidate.id,
            confirm: true,
            confirmSponsored: acknowledgedIds.includes(candidate.id),
          }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || "Penghapusan gagal.");
        completed += 1;
        onCleanupComplete?.(candidate.id);
      } catch (err) {
        failures.push(`${candidate.title}: ${err instanceof Error ? err.message : "Gagal"}`);
      }
    }
    setBusyIds([]);
    setSelectedIds([]);
    await refresh(true);
    if (failures.length) {
      setError(`${completed} event berhasil dibersihkan. ${failures.length} gagal: ${failures.join(" | ")}`);
    } else {
      setNotice(`${completed} event berhasil dibersihkan. Audit penghapusan telah disimpan.`);
    }
  };

  return (
    <section className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50/70 p-4 dark:border-red-950 dark:bg-red-950/20 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-gray-900 dark:text-white">NGIPEN Event Cleanup</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">Penghapusan manual untuk event yang sudah berakhir minimal 7 hari. Zona waktu: Asia/Jakarta.</p>
          {cutoffDate && <p className="mt-1 text-[11px] font-semibold text-red-700 dark:text-red-300">Kandidat dengan tanggal selesai sampai {formatDate(cutoffDate)}.</p>}
        </div>
        <button type="button" onClick={() => void refresh(true)} disabled={refreshing || loading} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-gray-900 dark:text-red-300">
          {refreshing ? "Memeriksa..." : "Perbarui daftar"}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3 dark:border-gray-800">
        {([
          ["candidates", `Kandidat (${candidates.length})`],
          ["history", `Riwayat (${history.length})`],
          ["failed", `Perlu perhatian (${failedHistory.length})`],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setActiveView(key)} className={`rounded-full px-4 py-2 text-xs font-bold ${activeView === key ? "bg-red-600 text-white" : "border border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">{notice}</div>}

      {loading ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-gray-500">Memuat data Event Cleanup...</div>
      ) : activeView === "candidates" ? (
        <>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            Periksa jumlah foto dan status file sebelum menghapus. File yang sudah hilang akan dicatat sebagai sudah tidak tersedia. File yang masih dipakai event lain akan dipertahankan.
          </div>
          {candidates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
              <p className="font-bold">Tidak ada event yang memenuhi syarat.</p>
              <p className="mt-1 text-xs text-gray-500">Event akan muncul setelah tanggal selesai melewati masa tunggu 7 hari.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 dark:border-gray-800">
                <label className="flex items-center gap-2 text-xs font-semibold">
                  <input type="checkbox" checked={candidates.length > 0 && candidates.every((item) => selectedIds.includes(item.id))} onChange={(event) => setSelectedIds(event.target.checked ? candidates.map((item) => item.id) : [])} className="h-4 w-4 accent-red-600" />
                  Pilih semua kandidat
                </label>
                <span className="text-xs text-gray-500">Dipilih: {selectedIds.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {candidates.map((item) => {
                  const requiresAck = item.is_sponsored || item.is_pinned;
                  const selected = selectedIds.includes(item.id);
                  return (
                    <article key={item.id} className={`rounded-2xl border p-4 dark:border-gray-800 ${selected ? "border-red-300 bg-red-50/40 dark:border-red-900 dark:bg-red-950/10" : "border-gray-200 bg-white dark:bg-gray-900"}`}>
                      <div className="flex gap-3">
                        <input aria-label={`Pilih ${item.title}`} type="checkbox" checked={selected} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="mt-1 h-4 w-4 shrink-0 accent-red-600" />
                        <PosterPreview src={item.poster_url} title={item.title} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start gap-2">
                            <h3 className="min-w-0 flex-1 break-words text-sm font-black text-gray-900 dark:text-white">{item.title}</h3>
                            {requiresAck && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{item.is_sponsored ? "Sponsored" : "Pinned"}{item.is_sponsored && item.is_pinned ? " + Pinned" : ""}</span>}
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{formatDate(item.start_date || item.end_date)} – {formatDate(item.end_date)}</p>
                          <p className="mt-1 text-xs font-semibold text-red-700 dark:text-red-300">Berakhir {numberFormat.format(item.daysSinceEnd)} hari lalu</p>
                          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-600 dark:text-gray-300">
                            <span>Dokumentasi: <b>{item.documentationCount}</b></span>
                            <span>File Storage: <b>{item.storagePresentCount}/{item.storageFileCount}</b></span>
                            <span>Ulasan: <b>{item.reviewCount}</b></span>
                            <span>Disimpan: <b>{item.saveCount}</b></span>
                            <span>Dilihat: <b>{item.viewCount}</b></span>
                            <span>Ukuran file: <b>{formatBytes(item.storageBytes)}</b></span>
                          </div>
                        </div>
                      </div>
                      {item.storageMissingCount > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">{item.storageMissingCount} file sudah tidak ditemukan di Storage. Kondisi ini tidak menghalangi cleanup.</p>}
                      {requiresAck && selected && (
                        <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                          <input type="checkbox" checked={acknowledgedIds.includes(item.id)} onChange={(event) => setAcknowledgedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="mt-0.5 h-4 w-4 accent-red-600" />
                          Saya memahami event ini masih sponsored/pinned dan menyetujui penghapusan permanennya.
                        </label>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="sticky bottom-3 flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-gray-700 dark:bg-gray-950/95 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-600 dark:text-gray-300">Aksi permanen untuk {selectedIds.length} event terpilih.</p>
                <button type="button" onClick={() => void executeCleanup()} disabled={!selectedIds.length || selectedNeedsAcknowledgement || busyIds.length > 0} className="rounded-xl bg-red-600 px-5 py-3 text-xs font-black text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
                  {busyIds.length ? "Sedang menghapus..." : `Hapus ${selectedIds.length} event terpilih`}
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {(activeView === "history" ? history : failedHistory).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-12 text-center text-sm text-gray-500 dark:border-gray-700">Belum ada catatan pada bagian ini.</div>
          ) : (activeView === "history" ? history : failedHistory).map((item) => (
            <article key={item.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{item.event_title}</p>
                <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.status === "completed" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>{item.status}</span>
              </div>
              <p className="mt-1 break-all text-[10px] text-gray-500">ID: {item.event_id}</p>
              <p className="mt-1 text-[11px] text-gray-500">{dateFormat.format(new Date(item.created_at))} · {item.deleted_file_count} file dihapus</p>
              {item.error_message && <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700 dark:bg-red-950/30 dark:text-red-200">{item.error_message}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
