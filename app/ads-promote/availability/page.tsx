"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type DayInfo = { booked: number; available: number; capacity: number; isEnabled: boolean };
type SlotData = { code: string; name: string; capacity: number; enabled: boolean; days: Record<string, DayInfo>; brands: Array<{ periods: Array<{ start: string; end: string }> }> };
type Availability = { timeZone: string; generatedAt: string; range: { start: string; endExclusive: string; today: string }; slots: SlotData[] };

const SLOT_ORDER = ["banner", "floating", "popup"];
const WA_NUMBER = "628138106774";
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function parseKey(key: string) { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function keyOf(date: Date) { return date.toISOString().slice(0, 10); }
function addDays(key: string, amount: number) { const date = parseKey(key); date.setUTCDate(date.getUTCDate() + amount); return keyOf(date); }
function monthKey(year: number, month: number) { return keyOf(new Date(Date.UTC(year, month, 1))); }
function formatDate(key: string) { return parseKey(key).toLocaleDateString("id-ID", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }); }
function formatMonth(key: string) { const date = parseKey(key); return MONTHS[date.getUTCMonth()] + " " + date.getUTCFullYear(); }

export default function AvailabilityPage() {
  const [data, setData] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("banner");
  const [selectedDate, setSelectedDate] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [timelineMonths, setTimelineMonths] = useState<1 | 3 | 6>(1);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/advertising/availability", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memuat kalender.");
      const value = result as Availability;
      setData(value);
      setSelectedDate(current => current || value.range.today);
      setMonth(current => current || value.range.start);
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat kalender."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const slots = useMemo(() => [...(data?.slots ?? [])].sort((a, b) => SLOT_ORDER.indexOf(a.code) - SLOT_ORDER.indexOf(b.code)), [data]);
  const currentSlot = slots.find(slot => slot.code === selectedSlot) ?? slots[0];
  const monthDate = month ? parseKey(month) : null;
  const monthFirst = monthDate ? monthKey(monthDate.getUTCFullYear(), monthDate.getUTCMonth()) : "";
  const daysInMonth = monthDate ? new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate() : 0;
  const offset = monthDate ? parseKey(monthFirst).getUTCDay() : 0;
  const monthCells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => addDays(monthFirst, i))];
  const selectedInfo = currentSlot?.days[selectedDate];
  const whatsappText = encodeURIComponent("Halo MAKICOS, saya ingin konsultasi ketersediaan iklan " + (currentSlot?.name ?? "NGIPEN") + " untuk periode " + (selectedDate ? formatDate(selectedDate) : "") + ".");
  const rangeStart = data?.range.start ?? "";
  const rangeLast = data ? addDays(data.range.endExclusive, -1) : "";

  function changeMonth(amount: number) {
    if (!monthDate || !data) return;
    const next = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + amount, 1));
    const key = keyOf(next);
    if (key >= data.range.start && key < data.range.endExclusive) setMonth(key);
  }

  return (
    <main className="min-h-screen bg-[#faf9f7] px-4 py-7 text-gray-900 dark:bg-[#101114] dark:text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <Link href="/ads-promote" className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:border-red-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">← ADS PROMOTE</Link>
          <button onClick={() => void load()} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold hover:border-red-300 dark:border-gray-700">↻ Refresh data</button>
        </div>
        <header className="mb-8">
          <p className="text-xs font-black uppercase tracking-[.24em] text-red-700 dark:text-red-400">NGIPEN Advertising</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Booked Calendar</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">Periksa ketersediaaan slot iklan berdasarkan tanggal</p>
          <p className="mt-2 text-xs text-gray-500">Zona waktu Asia/Jakarta (WIB) · Rentang {rangeStart ? formatDate(rangeStart) : "—"} – {rangeLast ? formatDate(rangeLast) : "—"}</p>
        </header>

        {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{error}</div>}
        {loading && !data && <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-800 dark:bg-gray-900">Memuat data ketersediaan…</div>}

        {data && <>
          <section className="mb-6 grid gap-3 sm:grid-cols-3">
            {slots.map(slot => {
              const today = slot.days[data.range.today];
              return <button key={slot.code} onClick={() => setSelectedSlot(slot.code)} className={`rounded-2xl border p-4 text-left transition ${selectedSlot === slot.code ? "border-red-500 bg-red-50 shadow-sm dark:bg-red-950/30" : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"}`}>
                <div className="flex items-center justify-between gap-2"><span className="font-black">{slot.name}</span><span className={`h-2.5 w-2.5 rounded-full ${slot.enabled ? "bg-green-500" : "bg-gray-400"}`} /></div>
                <div className="mt-3 flex items-end gap-2"><strong className="text-3xl tabular-nums">{today?.available ?? 0}</strong><span className="pb-1 text-xs text-gray-500">tersedia hari ini / {slot.capacity} kapasitas</span></div>
                <p className="mt-1 text-xs text-gray-500">{slot.enabled ? "Slot diaktifkan" : "Slot dinonaktifkan"}</p>
              </button>;
            })}
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="font-black">Kalender bulanan</h2><p className="text-xs text-gray-500">{currentSlot?.name ?? "Slot iklan"}</p></div>
                <div className="flex items-center gap-2"><button aria-label="Bulan sebelumnya" onClick={() => changeMonth(-1)} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">‹</button><strong className="min-w-32 text-center text-sm">{month ? formatMonth(month) : "—"}</strong><button aria-label="Bulan berikutnya" onClick={() => changeMonth(1)} className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">›</button></div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map(day => <div key={day} className="py-2 text-center text-[11px] font-bold text-gray-500">{day}</div>)}
                {monthCells.map((day, index) => {
                  if (!day) return <div key={"empty-" + index} />;
                  const info = currentSlot?.days[day];
                  const chosen = selectedDate === day;
                  const full = !info?.isEnabled || !info?.available;
                  return <button key={day} onClick={() => setSelectedDate(day)} className={`min-h-[68px] rounded-xl border p-1.5 text-left transition sm:min-h-[78px] sm:p-2 ${chosen ? "border-red-500 bg-red-50 ring-1 ring-red-500 dark:bg-red-950/30" : "border-gray-100 hover:border-gray-300 dark:border-gray-800"} `}>
                    <span className="text-xs font-bold">{parseKey(day).getUTCDate()}</span>
                    <span className={`mt-2 block rounded-md px-1 py-1 text-center text-[9px] font-black sm:text-[10px] ${full ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"}`}>{!info?.isEnabled ? "Off" : full ? "Booked" : "Available"}</span>
                    <span className="mt-1 block text-center text-[9px] text-gray-500">{info ? info.available + "/" + info.capacity : "—"}</span>
                  </button>;
                })}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-[11px] text-gray-500"><span>🟢 Tersedia</span><span>🔴 Penuh / nonaktif</span><span>Angka = slot tersedia / kapasitas</span></div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="font-black">Detail tanggal</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedDate ? formatDate(selectedDate) : "Pilih tanggal pada kalender"}</p>
                {selectedInfo && <div className="mt-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><strong className="text-2xl tabular-nums">{selectedInfo.capacity}</strong><p className="text-[10px] text-gray-500">Kapasitas</p></div>
                  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><strong className="text-2xl tabular-nums">{selectedInfo.booked}</strong><p className="text-[10px] text-gray-500">Terisi</p></div>
                  <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800"><strong className="text-2xl tabular-nums">{selectedInfo.available}</strong><p className="text-[10px] text-gray-500">Tersedia</p></div>
                </div>}
                <p className="mt-3 text-xs text-gray-500">{currentSlot?.name} · {selectedInfo?.isEnabled ? "Slot aktif" : "Slot tidak tersedia"}</p>
                <a href={`https://wa.me/${WA_NUMBER}?text=${whatsappText}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-black text-white hover:bg-green-700">Konsultasi via WhatsApp</a>
              </section>
              <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="font-black">Informasi booking</h2>
                <p className="mt-2 text-xs leading-5 text-gray-500">Periode dihitung dari campaign berstatus Active dan Scheduled. Kalender ini menampilkan ketersediaan indikatif. Konfirmasi akhir periode promosi dilakukan oleh tim MAKICOS melalui WhatsApp.</p>
              </section>
            </aside>
          </div>

          <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Timeline periode booking</h2><p className="text-xs text-gray-500">Setiap baris mewakili satu brand yang memasang iklan. Identitas brand dirahasiakan.</p></div><div className="flex rounded-xl border border-gray-200 p-1 dark:border-gray-700">{([1, 3, 6] as const).map(value => <button key={value} onClick={() => setTimelineMonths(value)} aria-pressed={timelineMonths === value} className={`rounded-lg px-3 py-2 text-xs font-bold transition ${timelineMonths === value ? "bg-red-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"}`}>{value}M</button>)}</div></div>
            <div className="space-y-5">
              {slots.map(slot => {
                const windowStart = rangeStart;
                const startDate = parseKey(windowStart);
                const windowEnd = monthKey(startDate.getUTCFullYear(), startDate.getUTCMonth() + timelineMonths);
                const windowEndExclusive = windowEnd < data.range.endExclusive ? windowEnd : data.range.endExclusive;
                const total = Date.parse(windowEndExclusive + "T00:00:00Z") - Date.parse(windowStart + "T00:00:00Z");
                const visibleBrands = slot.brands.map(brand => ({
                  periods: brand.periods.filter(period => period.end >= windowStart && period.start < windowEndExclusive),
                })).filter(brand => brand.periods.length > 0);
                return <div key={slot.code}>
                  <div className="mb-2 flex items-center justify-between"><strong className="text-sm">{slot.name}</strong><span className="text-xs text-gray-500">Kapasitas {slot.capacity} · {visibleBrands.length} brand</span></div>
                  {visibleBrands.length ? <div className="space-y-2">
                    {visibleBrands.map((brand, brandIndex) => <div key={brandIndex} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-2">
                      <span className="text-[11px] font-semibold text-gray-500">Brand {brandIndex + 1}</span>
                      <div className="relative h-8 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        {brand.periods.map((period, index) => {
                          const clippedStart = period.start < windowStart ? windowStart : period.start;
                          const clippedEnd = period.end >= windowEndExclusive ? addDays(windowEndExclusive, -1) : period.end;
                          const start = Date.parse(clippedStart + "T00:00:00Z");
                          const end = Date.parse(addDays(clippedEnd, 1) + "T00:00:00Z");
                          const left = ((start - Date.parse(windowStart + "T00:00:00Z")) / total) * 100;
                          const width = Math.max(.5, ((end - start) / total) * 100);
                          return <div key={index} title={period.start + " – " + period.end} className="absolute top-1 h-6 rounded-md border border-red-500/30 bg-red-500/75" style={{ left: left + "%", width: width + "%" }} />;
                        })}
                      </div>
                    </div>)}
                  </div> : <p className="rounded-lg bg-gray-50 px-3 py-3 text-[11px] text-gray-500 dark:bg-gray-800">Belum ada brand yang memasang iklan pada periode ini.</p>}
                  <div className="mt-2 flex justify-between text-[10px] text-gray-400"><span>{formatDate(windowStart)}</span><span>{formatDate(addDays(windowEndExclusive, -1))}</span></div>
                </div>;
              })}
            </div>
          </section>
        </>}
      </div>
    </main>
  );
}
