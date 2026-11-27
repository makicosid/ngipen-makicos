"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type Sponsor = { id: string; brand_name: string; contact_name: string | null; contact_email: string | null; notes: string | null; status: string };
type Campaign = {
  id: string; sponsor_id: string; slot_code: "banner" | "floating" | "popup"; campaign_name: string;
  image_path: string; target_url: string; status: string; starts_at: string; ends_at: string;
  ad_sponsors?: { brand_name: string } | Array<{ brand_name: string }>;
  creatives?: { id: string; image_path: string; target_url: string; sort_order: number; is_active: boolean }[];
  metrics: { impressions: number; clicks: number };
};
type Slot = { slot_code: string; display_name: string; max_visible: number; is_enabled: boolean };
type Dashboard = { sponsors: Sponsor[]; campaigns: Campaign[]; slots: Slot[] };

const inputClass = "mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-950";
const buttonClass = "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
type EditCreative = { imagePath: string; targetUrl: string; file: File | null };

// Campaign dates use Asia/Jakarta consistently with the public booked calendar.
function jakartaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateOnlyToIso(value: string, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Pilih tanggal mulai dan berakhir.");
  const now = new Date();
  if (!endOfDay && value === jakartaDateKey(now)) return now.toISOString();
  const [year, month, day] = value.split("-").map(Number);
  // WIB is UTC+7: local midnight is 17:00 UTC on the previous day.
  const utc = Date.UTC(year, month - 1, day, endOfDay ? 16 : -7, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime())) throw new Error("Tanggal kampanye tidak valid.");
  return date.toISOString();
}

export default function AdminAdvertisingPanel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [deletingBrand, setDeletingBrand] = useState(false);
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
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editCampaignName, setEditCampaignName] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [editCreatives, setEditCreatives] = useState<EditCreative[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCampaignForm, setShowCampaignForm] = useState(false);

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
      setSelectedBrandId(null);
      setSelectedCampaignId(null);
      setShowCampaignForm(false);
      setNotice("Data brand berhasil ditambahkan. Pilih brand dari daftar untuk mengelola campaign.");
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
      setShowCampaignForm(false);
      if (result.campaign?.id) setSelectedCampaignId(result.campaign.id);
      setNotice("Campaign berhasil dibuat sebagai terjadwal.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal membuat kampanye."); }
    finally { setSaving(false); setUploading(false); }
  }

  function beginEdit(campaign: Campaign) {
    const dateValue = (value: string) => jakartaDateKey(new Date(value));
    setEditingCampaign(campaign);
    setEditCampaignName(campaign.campaign_name);
    setEditStartsAt(dateValue(campaign.starts_at));
    setEditEndsAt(dateValue(campaign.ends_at));
    const creatives = campaign.creatives?.length ? campaign.creatives : [{ image_path: campaign.image_path, target_url: campaign.target_url, id: "", sort_order: 0, is_active: true }];
    setEditCreatives(creatives.map(item => ({ imagePath: item.image_path, targetUrl: item.target_url, file: null })));
    setError(""); setNotice("");
  }

  function updateEditCreative(index: number, patch: Partial<EditCreative>) {
    setEditCreatives(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function saveCampaignEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCampaign) return;
    setSaving(true); setError(""); setNotice("");
    try {
      if (editCreatives.length < 1 || editCreatives.length > 20) throw new Error("Jumlah poster harus 1–20.");
      const creatives = [];
      for (const creative of editCreatives) {
        let imagePath = creative.imagePath;
        if (creative.file) {
          const form = new FormData(); form.append("file", creative.file);
          const uploadResponse = await fetch("/api/admin/advertising/upload", { method: "POST", body: form });
          const uploadResult = await uploadResponse.json();
          if (!uploadResponse.ok) throw new Error(uploadResult.error || "Gagal mengunggah poster.");
          imagePath = uploadResult.path;
        }
        creatives.push({ imagePath, targetUrl: creative.targetUrl, isActive: true });
      }
      const response = await fetch("/api/admin/advertising", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_campaign", id: editingCampaign.id, campaignName: editCampaignName,
          startsAt: dateOnlyToIso(editStartsAt), endsAt: dateOnlyToIso(editEndsAt, true), creatives,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memperbarui kampanye.");
      setEditingCampaign(null); setEditCreatives([]);
      setNotice("Kampanye dan materi poster berhasil diperbarui.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memperbarui kampanye."); }
    finally { setSaving(false); }
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

  async function deleteCampaign(campaign: Campaign) {
    const confirmed = window.confirm(
      `Hapus kampanye "${campaign.campaign_name}" secara permanen? Statistik kampanye akan dihapus, sedangkan catatan audit tetap disimpan.`
    );
    if (!confirmed) return;

    setDeletingCampaignId(campaign.id);
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/advertising", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaign.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menghapus kampanye.");
      setNotice("Kampanye selesai berhasil dihapus.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus kampanye.");
    } finally {
      setDeletingCampaignId(null);
    }
  }

  async function deleteBrand(brand: Sponsor) {
    const confirmed = window.confirm(
      `HAPUS BRAND "${brand.brand_name}"? Semua campaign brand ini, termasuk yang sedang berjalan, seluruh poster, dan statistik campaign akan dihapus permanen dari Supabase. Tindakan ini tidak dapat dibatalkan. Catatan audit tetap disimpan.`
    );
    if (!confirmed) return;

    setDeletingBrand(true);
    setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/advertising", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_brand", id: brand.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menghapus brand.");
      setSelectedBrandId(null);
      setSelectedCampaignId(null);
      setShowCampaignForm(false);
      setEditingCampaign(null);
      setNotice(`Brand berhasil dihapus bersama ${result.deletedCampaigns ?? 0} campaign.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus brand.");
    } finally {
      setDeletingBrand(false);
    }
  }

  const statusLabel: Record<string, string> = { draft: "Draft", scheduled: "Terjadwal", active: "Aktif", paused: "Dijeda", completed: "Selesai" };
  const imageGuidance = {
    banner: { size: "1200 × 300 px", ratio: "4:1", note: "Banner horizontal untuk area konten halaman." },
    floating: { size: "600 × 600 px", ratio: "1:1", note: "Gambar persegi agar tetap jelas di kartu kecil ponsel." },
    popup: { size: "1080 × 1350 px", ratio: "4:5", note: "Format portrait; bagian gambar menyesuaikan tinggi layar ponsel." },
  }[slotCode];

  const selectedBrand = data?.sponsors.find(s => s.id === selectedBrandId) ?? null;
  const brandCampaigns = (data?.campaigns ?? []).filter(c => c.sponsor_id === selectedBrandId);
  const selectedCampaign = brandCampaigns.find(c => c.id === selectedCampaignId) ?? null;
  const slotNames: Record<string, string> = { banner: "Banner", floating: "Floating", popup: "Pop Up" };

  return (
    <section className="mt-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Total Brand", data?.sponsors.length ?? 0],
          ["Total Campaign", data?.campaigns.length ?? 0],
          ["Impression 30 Hari", data?.campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0) ?? 0],
        ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 text-2xl font-black">{loading ? "…" : Number(value).toLocaleString("id-ID")}</p></div>)}
      </div>

      <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
        <div className="mb-3"><h3 className="font-bold">Slot Iklan</h3><p className="text-xs text-gray-500">Konfigurasi slot yang tersedia di database.</p></div>
        <div className="grid gap-2 sm:grid-cols-3">
          {(data?.slots ?? []).map(slot => <div key={slot.slot_code} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-950"><p className="font-bold">{slot.display_name}</p><p className="mt-1 text-xs text-gray-500">Maksimal tampil: {slot.max_visible} brand</p><p className={`mt-2 text-xs font-bold ${slot.is_enabled ? "text-green-600" : "text-gray-400"}`}>{slot.is_enabled ? "Aktif" : "Nonaktif"}</p></div>)}
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">{notice}</p>}

      {!selectedBrand && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-lg font-bold">Daftar Brand</h3><p className="text-xs text-gray-500">Pilih brand untuk melihat dan mengelola campaign iklannya.</p></div>
            <button type="button" onClick={() => document.getElementById("add-ad-brand")?.scrollIntoView({ behavior: "smooth", block: "center" })} className={buttonClass}>+ Tambah Brand</button>
          </div>
          {loading ? <p className="py-8 text-center text-sm text-gray-500">Memuat data brand...</p> : !data?.sponsors.length ? <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">Belum ada brand. Tambahkan brand pertama untuk mulai mengelola iklan.</p> : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.sponsors.map(s => {
                const campaigns = data.campaigns.filter(c => c.sponsor_id === s.id);
                const activeCount = campaigns.filter(c => c.status === "active" && new Date(c.ends_at).getTime() > Date.now()).length;
                return <button type="button" key={s.id} onClick={() => { setSelectedBrandId(s.id); setSponsorId(s.id); setSelectedCampaignId(null); setShowCampaignForm(false); setEditingCampaign(null); setError(""); setNotice(""); }} className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-red-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-bold">{s.brand_name}</h4><p className="mt-1 text-xs text-gray-500">{s.contact_name || "Kontak belum diisi"}</p></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold dark:bg-gray-800">{s.status === "active" ? "Brand Aktif" : s.status}</span></div>
                  <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-gray-800"><span className="text-gray-500">{campaigns.length} campaign · {activeCount} aktif</span><span className="font-bold text-red-600">Kelola <span aria-hidden>→</span></span></div>
                </button>;
              })}
            </div>
          )}
          <form id="add-ad-brand" onSubmit={submitSponsor} className="space-y-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div><h3 className="font-bold">Tambah Brand</h3><p className="text-xs text-gray-500">Simpan identitas brand atau partner iklan terlebih dahulu. Campaign dibuat setelah brand dipilih.</p></div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm font-semibold">Nama brand<input className={inputClass} value={brandName} onChange={e => setBrandName(e.target.value)} maxLength={120} required placeholder="Nama brand / komunitas" /></label>
              <label className="block text-sm font-semibold">Nama kontak<input className={inputClass} value={contactName} onChange={e => setContactName(e.target.value)} maxLength={120} placeholder="Opsional" /></label>
              <label className="block text-sm font-semibold">Email kontak<input className={inputClass} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} maxLength={254} placeholder="email@contoh.com" /></label>
              <label className="block text-sm font-semibold md:col-span-2">Catatan<textarea className={inputClass} value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} rows={2} placeholder="Catatan internal (opsional)" /></label>
            </div>
            <button className={buttonClass} disabled={saving || loading}>{saving ? "Menyimpan..." : "Simpan Brand"}</button>
          </form>
        </>
      )}

      {selectedBrand && !selectedCampaign && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3"><button type="button" onClick={() => { setSelectedBrandId(null); setSelectedCampaignId(null); setShowCampaignForm(false); setEditingCampaign(null); }} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700">← Brand</button><div><p className="text-xs text-gray-500">Detail brand</p><h3 className="text-xl font-black">{selectedBrand.brand_name}</h3></div></div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 dark:bg-green-950 dark:text-green-300">{selectedBrand.status === "active" ? "Brand Aktif" : selectedBrand.status}</span>
              <button type="button" onClick={() => void deleteBrand(selectedBrand)} disabled={deletingBrand || saving} className="rounded-xl border border-red-300 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950">{deletingBrand ? "Menghapus brand..." : "Hapus Brand"}</button>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-bold">Informasi Brand</h4><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{selectedBrand.contact_name || "Nama kontak belum diisi"}{selectedBrand.contact_email ? " · " + selectedBrand.contact_email : ""}</p>{selectedBrand.notes && <p className="mt-2 text-xs text-gray-500">{selectedBrand.notes}</p>}</div><span className="text-xs text-gray-500">{brandCampaigns.length} campaign terdaftar</span></div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-lg font-bold">Campaign berdasarkan slot</h4><p className="text-xs text-gray-500">Pilih campaign untuk membuka halaman detail tersendiri.</p></div>{!showCampaignForm && <button type="button" onClick={() => { setSponsorId(selectedBrand.id); setShowCampaignForm(true); setEditingCampaign(null); }} className={buttonClass}>+ Tambah Campaign</button>}</div>
          <div className="grid gap-4 lg:grid-cols-3">
            {(["banner", "floating", "popup"] as const).map(slot => {
              const campaigns = brandCampaigns.filter(c => c.slot_code === slot);
              return <section key={slot} className="min-w-0 rounded-2xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between gap-2"><h5 className="font-bold">{slotNames[slot]}</h5><span className="text-xs text-gray-500">{campaigns.length} campaign</span></div>
                {campaigns.length ? <div className="space-y-2">{campaigns.map(c => <button type="button" key={c.id} onClick={() => { setSelectedCampaignId(c.id); setEditingCampaign(null); setShowCampaignForm(false); setError(""); setNotice(""); }} className="w-full rounded-xl bg-gray-50 p-3 text-left transition hover:bg-red-50 dark:bg-gray-950 dark:hover:bg-red-950/30"><div className="flex items-start justify-between gap-2"><span className="font-semibold">{c.campaign_name}</span><span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold dark:bg-gray-800">{statusLabel[c.status] || c.status}</span></div><p className="mt-2 text-xs text-gray-500">{c.creatives?.length || 1} materi poster</p><p className="mt-1 text-xs text-gray-500">Impression {c.metrics.impressions.toLocaleString("id-ID")} · Click {c.metrics.clicks.toLocaleString("id-ID")}</p><p className="mt-2 text-right text-xs font-bold text-red-600">Detail campaign →</p></button>)}</div> : <p className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500 dark:border-gray-700">Belum ada campaign pada slot ini.</p>}
              </section>;
            })}
          </div>
          {showCampaignForm && (
            <form onSubmit={submitCampaign} className="space-y-3 rounded-2xl border-2 border-red-200 p-4 dark:border-red-900">
              <div className="flex items-start justify-between gap-3"><div><h4 className="font-bold">Tambah Campaign · {selectedBrand.brand_name}</h4><p className="text-xs text-gray-500">Campaign otomatis terhubung dengan brand ini.</p></div><button type="button" onClick={() => setShowCampaignForm(false)} className="rounded-lg border px-3 py-2 text-xs font-bold">Batal</button></div>
              <label className="block text-sm font-semibold">Nama campaign<input className={inputClass} value={campaignName} onChange={e => setCampaignName(e.target.value)} maxLength={150} required placeholder="Nama campaign" /></label>
              <label className="block text-sm font-semibold">Slot iklan<select className={inputClass} value={slotCode} onChange={e => setSlotCode(e.target.value as typeof slotCode)}><option value="banner">Banner</option><option value="floating">Floating</option><option value="popup">Pop Up</option></select></label>
              <div className="rounded-xl border border-red-100 bg-red-50/70 p-3 text-xs dark:border-red-900/50 dark:bg-red-950/20"><p className="font-bold text-red-700 dark:text-red-300">Rekomendasi gambar: {imageGuidance.size} · Rasio {imageGuidance.ratio}</p><p className="mt-1 text-gray-600 dark:text-gray-300">{imageGuidance.note} JPG, PNG, WEBP, atau AVIF; maksimal 5 MB.</p></div>
              <label className="block text-sm font-semibold">Gambar iklan<input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => { setImageFile(e.target.files?.[0] ?? null); setImagePath(""); }} required={!imagePath} /></label>
              {imagePreview && <img src={imagePreview} alt="Preview gambar iklan" className="max-h-36 w-full rounded-xl border border-gray-200 object-contain dark:border-gray-700" />}
              <label className="block text-sm font-semibold">URL tujuan<input className={inputClass} type="url" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} required placeholder="https://contoh.com" /></label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="block text-sm font-semibold">Tanggal mulai<input className={inputClass} type="date" value={startsAt} onChange={e => setStartsAt(e.target.value)} required /></label><label className="block text-sm font-semibold">Tanggal berakhir<input className={inputClass} type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} min={startsAt || undefined} required /></label></div>
              <p className="text-xs text-gray-500">Jika mulai hari ini, campaign dimulai saat dibuat. Tanggal mendatang dimulai pukul 00.00 dan berakhir pukul 23.59 waktu lokal admin.</p>
              <button className={buttonClass} disabled={saving || uploading || loading || !selectedBrand}>{uploading ? "Mengunggah gambar..." : saving ? "Menyimpan..." : "Simpan Campaign"}</button>
            </form>
          )}
        </div>
      )}

      {selectedBrand && selectedCampaign && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3"><button type="button" onClick={() => { setSelectedCampaignId(null); setEditingCampaign(null); }} className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold dark:border-gray-700">← {selectedBrand.brand_name}</button><div><p className="text-xs text-gray-500">{slotNames[selectedCampaign.slot_code]} · {selectedBrand.brand_name}</p><h3 className="text-xl font-black">{selectedCampaign.campaign_name}</h3></div></div>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border p-3 dark:border-gray-800"><p className="text-xs text-gray-500">Status</p><p className="mt-1 font-bold">{statusLabel[selectedCampaign.status] || selectedCampaign.status}</p></div><div className="rounded-xl border p-3 dark:border-gray-800"><p className="text-xs text-gray-500">Impression · 30 hari</p><p className="mt-1 font-bold">{selectedCampaign.metrics.impressions.toLocaleString("id-ID")}</p></div><div className="rounded-xl border p-3 dark:border-gray-800"><p className="text-xs text-gray-500">Click · 30 hari</p><p className="mt-1 font-bold">{selectedCampaign.metrics.clicks.toLocaleString("id-ID")}</p></div></div>
          <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"><h4 className="font-bold">Periode Campaign</h4><p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{new Date(selectedCampaign.starts_at).toLocaleString("id-ID")} – {new Date(selectedCampaign.ends_at).toLocaleString("id-ID")}</p><p className="mt-2 break-all text-xs text-gray-500">URL utama: {selectedCampaign.target_url}</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => beginEdit(selectedCampaign)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 dark:border-blue-900 dark:text-blue-300">Edit Campaign & Poster</button>
            {selectedCampaign.status !== "paused" && selectedCampaign.status !== "completed" && <button type="button" onClick={() => void updateStatus(selectedCampaign.id, "paused")} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold dark:border-gray-700">Jeda</button>}
            {(selectedCampaign.status === "paused" || selectedCampaign.status === "completed") && new Date(selectedCampaign.ends_at).getTime() > Date.now() && <button type="button" onClick={() => void updateStatus(selectedCampaign.id, new Date(selectedCampaign.starts_at).getTime() > Date.now() ? "scheduled" : "active")} className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">Aktifkan Kembali</button>}
            {selectedCampaign.status !== "completed" && <button type="button" onClick={() => void updateStatus(selectedCampaign.id, "completed")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 dark:border-red-900">Akhiri</button>}
            {(selectedCampaign.status === "completed" || new Date(selectedCampaign.ends_at).getTime() <= Date.now()) && <button type="button" onClick={() => void deleteCampaign(selectedCampaign)} disabled={deletingCampaignId === selectedCampaign.id} className="rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300">{deletingCampaignId === selectedCampaign.id ? "Menghapus..." : "Hapus Campaign"}</button>}
          </div>
          {editingCampaign && editingCampaign.id === selectedCampaign.id && (
            <form onSubmit={saveCampaignEdit} className="space-y-4 rounded-2xl border-2 border-red-200 p-4 dark:border-red-900">
              <div className="flex items-center justify-between gap-2"><div><h4 className="font-bold">Edit Campaign</h4><p className="text-xs text-gray-500">Atur periode serta poster dan URL tujuan.</p></div><button type="button" onClick={() => setEditingCampaign(null)} className="rounded-lg border px-3 py-2 text-xs font-bold">Batal</button></div>
              <label className="block text-sm font-semibold">Nama campaign<input className={inputClass} value={editCampaignName} onChange={e => setEditCampaignName(e.target.value)} maxLength={150} required /></label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="block text-sm font-semibold">Tanggal mulai<input className={inputClass} type="date" value={editStartsAt} onChange={e => setEditStartsAt(e.target.value)} required /></label><label className="block text-sm font-semibold">Tanggal berakhir<input className={inputClass} type="date" value={editEndsAt} onChange={e => setEditEndsAt(e.target.value)} min={editStartsAt || undefined} required /></label></div>
              <div className="space-y-3"><div className="flex items-center justify-between"><h5 className="text-sm font-bold">Poster dan link tujuan</h5><button type="button" disabled={editCreatives.length >= 20} onClick={() => setEditCreatives(items => [...items, { imagePath: "", targetUrl: "", file: null }])} className="rounded-lg border px-3 py-2 text-xs font-bold">+ Tambah Poster</button></div>
                {editCreatives.map((creative, index) => <div key={index} className="space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-950"><div className="flex items-center justify-between"><p className="text-xs font-bold">Materi {index + 1}</p><button type="button" disabled={editCreatives.length <= 1} onClick={() => setEditCreatives(items => items.filter((_, i) => i !== index))} className="text-xs font-bold text-red-600">Hapus</button></div>{creative.imagePath && !creative.file && <img src={`${process.env.NEXT_PUBLIC_SUPABASE_URL || ""}/storage/v1/object/public/ad-assets/${creative.imagePath}`} alt={`Poster ${index + 1}`} className="max-h-32 rounded-lg object-contain" />}<label className="block text-xs font-semibold">Ganti / unggah poster<input className={inputClass} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => updateEditCreative(index, { file: e.target.files?.[0] ?? null })} /></label><label className="block text-xs font-semibold">Path poster<input className={inputClass} value={creative.imagePath} onChange={e => updateEditCreative(index, { imagePath: e.target.value })} required={!creative.file} /></label><label className="block text-xs font-semibold">URL tujuan<input className={inputClass} type="url" value={creative.targetUrl} onChange={e => updateEditCreative(index, { targetUrl: e.target.value })} required placeholder="https://contoh.com" /></label></div>)}
              </div>
              <button className={buttonClass} disabled={saving || uploading}>{saving ? "Menyimpan perubahan..." : "Simpan Perubahan"}</button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}