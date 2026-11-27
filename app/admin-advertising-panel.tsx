"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Sponsor = { id: string; brand_name: string; contact_name: string | null; contact_email: string | null; notes: string | null; status: string };
type Campaign = {
  id: string; sponsor_id: string; slot_code: "banner" | "floating" | "popup"; campaign_name: string;
  image_path: string; target_url: string; status: string; starts_at: string; ends_at: string;
  ad_sponsors?: { brand_name: string } | Array<{ brand_name: string }>;
  metrics: { impressions: number; clicks: number };
};
type Slot = { slot_code: string; display_name: string; max_visible: number; is_enabled: boolean };
type Dashboard = { sponsors: Sponsor[]; campaigns: Campaign[]; slots: Slot[] };

const inputClass = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950";
const buttonClass = "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";

// Date input is interpreted in the admin's local timezone.
// Campaign starts at 00:00 on the selected start date and ends at 23:59:59.999
// on the selected end date, so admins never need to enter a time manually.
function dateOnlyToIso(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Pilih tanggal mulai dan berakhir.");
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
  if (!Number.isFinite(date.getTime())) throw new Error("Tanggal kampanye tidak valid.");
  return date.toISOString();
}

export default function AdminAdvertisingPanel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [brandName, setBrandName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [sponsorId, setSponsorId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [slotCode, setSlotCode] = useState<"banner" | "floating" | "popup">("banner");
  const [targetUrl, setTargetUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState("");
  const [imagePreview, setImagePreview] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/advertising", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memuat Advertising Partner.");
      setData(result as Dashboard);
      if (!sponsorId && result.sponsors?.[0]) setSponsorId(result.sponsors[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, [sponsorId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!imageFile) { setImagePreview(""); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  async function submitSponsor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/advertising", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_sponsor", brandName, contactName, contactEmail, notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menyimpan sponsor.");
      setBrandName(""); setContactName(""); setContactEmail(""); setNotes("");
      setSponsorId(result.sponsor.id);
      setNotice("Data sponsor berhasil ditambahkan.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal menyimpan sponsor."); }
    finally { setSaving(false); }
  }

  async function submitCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      if (!sponsorId) throw new Error("Tambahkan atau pilih sponsor terlebih dahulu.");
      let uploadedPath = imagePath;
      if (imageFile) {
        setUploading(true);
        const form = new FormData(); form.append("file", imageFile);
        const uploadResponse = await fetch("/api/admin/advertising/upload", { method: "POST", body: form });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok) throw new Error(uploadResult.error || "Gagal mengunggah gambar.");
        uploadedPath = uploadResult.path;
        setImagePath(uploadedPath);
        setUploading(false);
      }
      if (!uploadedPath) throw new Error("Pilih gambar iklan terlebih dahulu.");
      const campaignStartsAt = dateOnlyToIso(startsAt);
      const campaignEndsAt = dateOnlyToIso(endsAt, true);
      if (new Date(campaignEndsAt).getTime() < new Date(campaignStartsAt).getTime()) {
        throw new Error("Tanggal berakhir harus sama dengan atau setelah tanggal mulai.");
      }
      const response = await fetch("/api/admin/advertising", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_campaign", sponsorId, campaignName, slotCode, imagePath: uploadedPath, targetUrl, startsAt: campaignStartsAt, endsAt: campaignEndsAt }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal membuat kampanye.");
      setCampaignName(""); setTargetUrl(""); setStartsAt(""); setEndsAt(""); setImageFile(null); setImagePath("");
      setNotice("Kampanye berhasil dibuat sebagai terjadwal. Kampanye akan tampil sesuai periode yang ditentukan.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat kampanye."); }
    finally { setSaving(false); setUploading(false); }
  }

  async function updateStatus(id: string, status: string) {
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/advertising", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memperbarui status.");
      setNotice("Status kampanye diperbarui.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memperbarui status."); }
  }

  const statusLabel: Record<string, string> = { draft: "Draft", scheduled: "Terjadwal", active: "Aktif", paused: "Dijeda", completed: "Selesai" };
  const imageGuidance = {
    banner: { size: "1200 × 300 px", ratio: "4:1", note: "Banner horizontal untuk area konten halaman." },
    floating: { size: "600 × 600 px", ratio: "1:1", note: "Gambar persegi agar tetap jelas di kartu kecil ponsel." },
    popup: { size: "1080 × 1350 px", ratio: "4:5", note: "Format portrait; bagian gambar menyesuaikan tinggi layar ponsel." },
  }[slotCode];

  return (
    <section className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total Sponsor", data?.sponsors.length ?? 0],
          ["Total Kampanye", data?.campaigns.length ?? 0],
          ["Total Impression 30 Hari", data?.campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0) ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-black">{loading ? "…" : Number(value).toLocaleString("id-ID")}</p></div>)}
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-3"><h3 className="font-bold">Slot Iklan</h3><p className="text-xs text-gray-500">Konfigurasi slot yang sudah tersedia di database.</p></div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(data?.slots ?? []).map(slot => <div key={slot.slot_code} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950"><p className="font-bold">{slot.display_name}</p><p className="mt-1 text-xs text-gray-500">Maksimal tampil: {slot.max_visible}</p><p className={`mt-2 text-xs font-bold ${slot.is_enabled ? "text-green-600" : "text-gray-400"}`}>{slot.is_enabled ? "Aktif" : "Nonaktif"}</p></div>)}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submitSponsor} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <div><h3 className="font-bold">Tambah Sponsor</h3><p className="text-xs text-gray-500">Simpan identitas brand atau partner iklan.</p></div>
          <label className="block text-sm font-semibold">Nama brand<input className={inputClass} value={brandName} onChange={e => setBrandName(e.target.value)} maxLength={120} required placeholder="Nama brand / komunitas" /></label>
          <label className="block text-sm font-semibold">Nama kontak<input className={inputClass} value={contactName} onChange={e => setContactName(e.target.value)} maxLength={120} placeholder="Opsional" /></label>
          <label className="block text-sm font-semibold">Email kontak<input className={inputClass} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} maxLength={254} placeholder="email@contoh.com" /></label>
          <label className="block text-sm font-semibold">Catatan<textarea className={inputClass} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Catatan internal (opsional)" /></label>
          <button className={buttonClass} disabled={saving || loading}>{saving ? "Menyimpan..." : "Simpan Sponsor"}</button>
        </form>

        <form onSubmit={submitCampaign} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
          <div><h3 className="font-bold">Buat Kampanye Iklan</h3><p className="text-xs text-gray-500">Gambar maksimal 5 MB, JPG / PNG / WEBP / AVIF. URL tujuan wajib HTTPS.</p></div>
          <label className="block text-sm font-semibold">Sponsor<select className={inputClass} value={sponsorId} onChange={e => setSponsorId(e.target.value)} required><option value="">Pilih sponsor</option>{(data?.sponsors ?? []).filter(s => s.status === "active").map(s => <option key={s.id} value={s.id}>{s.brand_name}</option>)}</select></label>
          <label className="block text-sm font-semibold">Nama kampanye<input className={inputClass} value={campaignName} onChange={e => setCampaignName(e.target.value)} maxLength={150} required placeholder="Nama kampanye" /></label>
          <label className="block text-sm font-semibold">Penempatan<select className={inputClass} value={slotCode} onChange={e => setSlotCode(e.target.value as typeof slotCode)}><option value="banner">Banner</option><option value="floating">Floating Banner</option><option value="popup">Popup Advertisement</option></select></label>
          <div className="rounded-xl border border-red-100 bg-red-50/70 p-3 text-xs dark:border-red-900/50 dark:bg-red-950/20">
            <p className="font-bold text-red-700 dark:text-red-300">Rekomendasi gambar: {imageGuidance.size} · Rasio {imageGuidance.ratio}</p>
            <p className="mt-1 text-gray-600 dark:text-gray-300">{imageGuidance.note} Gunakan JPG, PNG, WEBP, atau AVIF; ukuran file maksimal 5 MB.</p>
          </div>
          <label className="block text-sm font-semibold">Gambar iklan<input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => { setImageFile(e.target.files?.[0] ?? null); setImagePath(""); }} required={!imagePath} /></label>
          {imagePreview && <img src={imagePreview} alt="Preview gambar iklan" className="max-h-36 w-full rounded-xl border border-gray-200 object-contain dark:border-gray-700" />}
          <label className="block text-sm font-semibold">URL tujuan<input className={inputClass} type="url" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} required placeholder="https://contoh.com" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm font-semibold">Tanggal mulai<input className={inputClass} type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} required /></label>
            <label className="block text-sm font-semibold">Tanggal berakhir<input className={inputClass} type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} min={startsAt || undefined} required /></label>
          </div>
          <p className="text-xs text-gray-500">Jam diatur otomatis: mulai pukul 00.00 pada tanggal mulai dan berakhir pukul 23.59 pada tanggal berakhir (waktu lokal perangkat admin).</p>
          <button className={buttonClass} disabled={saving || uploading || loading || !data?.sponsors.some(s => s.status === "active")}>{uploading ? "Mengunggah gambar..." : saving ? "Menyimpan..." : "Buat Kampanye"}</button>
        </form>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{notice}</p>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">Daftar Kampanye</h3><p className="text-xs text-gray-500">Statistik impression dan click dalam 30 hari terakhir.</p></div><button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Muat Ulang</button></div>
        {loading ? <p className="py-6 text-center text-sm text-gray-500">Memuat data...</p> : !data?.campaigns.length ? <p className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500 dark:border-gray-700">Belum ada kampanye iklan.</p> : data.campaigns.map(c => {
          const sponsor = Array.isArray(c.ad_sponsors) ? c.ad_sponsors[0]?.brand_name : c.ad_sponsors?.brand_name;
          return <article key={c.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold">{c.campaign_name}</h4><span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold dark:bg-gray-800">{statusLabel[c.status] || c.status}</span></div><p className="mt-1 text-xs text-gray-500">{sponsor || "Sponsor"} · {c.slot_code}</p><p className="mt-1 break-all text-xs text-gray-500">{c.target_url}</p><p className="mt-2 text-xs text-gray-500">{new Date(c.starts_at).toLocaleString("id-ID")} – {new Date(c.ends_at).toLocaleString("id-ID")}</p></div>
              <div className="flex gap-3 text-xs"><span>👁 {c.metrics.impressions.toLocaleString("id-ID")}</span><span>↗ {c.metrics.clicks.toLocaleString("id-ID")}</span></div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {c.status !== "paused" && c.status !== "completed" ? <button type="button" onClick={() => void updateStatus(c.id, "paused")} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Jeda</button> : null}
              {(c.status === "paused" || c.status === "completed") && new Date(c.ends_at).getTime() > Date.now() ? <button type="button" onClick={() => void updateStatus(c.id, new Date(c.starts_at).getTime() > Date.now() ? "scheduled" : "active")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">{new Date(c.starts_at).getTime() > Date.now() ? "Jadwalkan Ulang" : "Aktifkan Kembali"}</button> : null}
              {c.status !== "completed" && <button type="button" onClick={() => void updateStatus(c.id, "completed")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 dark:border-red-900">Akhiri</button>}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
