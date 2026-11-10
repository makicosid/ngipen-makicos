"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Campaign = {
  id: string;
  title: string;
  body: string;
  target_url: string;
  status: string;
  total_targets: number;
  total_sent: number;
  total_failed: number;
  created_at: string;
  send_started_at?: string | null;
  completed_at?: string | null;
};

type Dashboard = {
  activeDevices: number;
  campaigns: Campaign[];
  sendingEnabled: boolean;
};

export default function AdminPushPanel() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetUrl, setTargetUrl] = useState("/");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/push", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memuat dashboard.");
      setDashboard(result as Dashboard);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, targetUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan draft.");
      setTitle("");
      setBody("");
      setTargetUrl("/");
      setNotice("Draft notifikasi berhasil disimpan. Belum ada notifikasi yang dikirim.");
      await loadDashboard();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Gagal menyimpan draft.");
    } finally {
      setSaving(false);
    }
  }

  const statusLabel: Record<string, string> = {
    draft: "Draft",
    sending: "Sedang dikirim",
    completed: "Selesai",
    completed_with_errors: "Selesai dengan kegagalan",
    failed: "Gagal",
  };

  return (
    <section className="mt-5 space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
          <p className="text-xs text-gray-500">Perangkat dengan notifikasi aktif</p>
          <p className="mt-1 text-3xl font-black">{loading ? "…" : (dashboard?.activeDevices ?? 0).toLocaleString("id-ID")}</p>
          <p className="mt-1 text-xs text-gray-500">Jumlah perangkat, bukan jumlah akun pengguna.</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Status pengiriman produksi</p>
          <p className="mt-1 text-lg font-black text-amber-900 dark:text-amber-200">Belum diaktifkan</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Pengiriman tetap terkunci sampai ada persetujuan terpisah.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <div>
          <h3 className="font-bold">Buat Draft Notifikasi</h3>
          <p className="mt-1 text-xs text-gray-500">Draft hanya disimpan ke database. Form ini tidak mengirim pesan.</p>
        </div>
        <label className="block text-sm font-semibold">
          Judul notifikasi
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required placeholder="Contoh: Jadwal Event Akhir Pekan" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950" />
          <span className="mt-1 block text-right text-xs font-normal text-gray-500">{title.length}/120</span>
        </label>
        <label className="block text-sm font-semibold">
          Isi notifikasi
          <textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={500} required rows={4} placeholder="Tulis informasi singkat yang akan diterima pengguna..." className="mt-1 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950" />
          <span className="mt-1 block text-right text-xs font-normal text-gray-500">{body.length}/500</span>
        </label>
        <label className="block text-sm font-semibold">
          Halaman tujuan
          <input value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} maxLength={500} required placeholder="/" className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950" />
          <span className="mt-1 block text-xs font-normal text-gray-500">Gunakan path internal, misalnya / atau /event/nama-event.</span>
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{notice}</p>}
        <button type="submit" disabled={saving || loading} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{saving ? "Menyimpan..." : "Simpan Draft"}</button>
      </form>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">Riwayat Kampanye</h3>
            <p className="text-xs text-gray-500">Menampilkan maksimal 25 kampanye terbaru.</p>
          </div>
          <button type="button" onClick={() => void loadDashboard()} disabled={loading} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Muat Ulang</button>
        </div>
        {loading ? <p className="py-6 text-center text-sm text-gray-500">Memuat kampanye...</p> : !dashboard?.campaigns.length ? (
          <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Belum ada draft atau riwayat kampanye.</p>
        ) : (
          <div className="space-y-3">
            {dashboard.campaigns.map((campaign) => (
              <article key={campaign.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="break-words font-bold">{campaign.title}</h4>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-300">{campaign.body}</p>
                    <p className="mt-2 break-all text-xs text-gray-500">Tujuan: {campaign.target_url}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold dark:bg-gray-800">{statusLabel[campaign.status] || campaign.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Target: {campaign.total_targets}</span>
                  <span>Diterima FCM: {campaign.total_sent}</span>
                  <span>Gagal: {campaign.total_failed}</span>
                  <span>{new Date(campaign.created_at).toLocaleString("id-ID")}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
