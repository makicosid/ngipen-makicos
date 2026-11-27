"use client";

import { useMemo, useState } from "react";

type Props = {
  startId: string;
  endId: string;
  initialStart?: string;
  initialEnd?: string;
};

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const fromKey = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const formatDate = (value: string) => value
  ? fromKey(value).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  : "Pilih tanggal";

export default function EventDateRangePicker({ startId, endId, initialStart = "", initialEnd = "" }: Props) {
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<"start" | "end">("start");
  const [month, setMonth] = useState(() => {
    const initial = initialStart ? fromKey(initialStart) : new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);

  const chooseDate = (day: number) => {
    const value = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
    if (activeField === "start") {
      setStartDate(value);
      if (endDate && endDate < value) setEndDate("");
      setActiveField("end");
    } else {
      if (startDate && value < startDate) return;
      setEndDate(value);
      setOpen(false);
      setActiveField("start");
    }
  };

  const monthLabel = month.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="relative sm:col-span-2">
      <input id={startId} name="start_date" type="hidden" value={startDate} readOnly />
      <input id={endId} name="end_date" type="hidden" value={endDate} readOnly />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => { setActiveField("start"); setOpen(true); }} className={`rounded-xl border px-4 py-3 text-left transition ${open && activeField === "start" ? "border-red-500 ring-2 ring-red-100" : "border-gray-200 dark:border-gray-700"} bg-gray-50 dark:bg-gray-950`}>
          <span className="block text-xs font-semibold text-gray-500">Tanggal mulai *</span>
          <span className={`mt-1 block text-sm font-bold ${startDate ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>{formatDate(startDate)}</span>
        </button>
        <button type="button" onClick={() => { setActiveField("end"); setOpen(true); }} className={`rounded-xl border px-4 py-3 text-left transition ${open && activeField === "end" ? "border-red-500 ring-2 ring-red-100" : "border-gray-200 dark:border-gray-700"} bg-gray-50 dark:bg-gray-950`}>
          <span className="block text-xs font-semibold text-gray-500">Tanggal selesai *</span>
          <span className={`mt-1 block text-sm font-bold ${endDate ? "text-gray-900 dark:text-white" : "text-gray-400"}`}>{formatDate(endDate)}</span>
        </button>
      </div>
      {open && (
        <div className="mt-3 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Bulan sebelumnya" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">‹</button>
            <div className="text-center">
              <p className="text-sm font-black capitalize">{monthLabel}</p>
              <p className="text-[11px] text-gray-500">{activeField === "start" ? "Pilih tanggal mulai" : "Pilih tanggal selesai"}</p>
            </div>
            <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Bulan berikutnya" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">›</button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-500">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(day => <span key={day} className="py-2">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} />;
              const value = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
              const selected = value === startDate || value === endDate;
              const inRange = startDate && endDate && value > startDate && value < endDate;
              const disabled = activeField === "end" && Boolean(startDate) && value < startDate;
              return <button key={value} type="button" disabled={disabled} onClick={() => chooseDate(day)} className={`aspect-square rounded-lg text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-25 ${selected ? "bg-red-600 text-white" : inRange ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-200" : "hover:bg-gray-100 dark:hover:bg-gray-800"}`}>{day}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
            <button type="button" onClick={() => { setStartDate(""); setEndDate(""); setActiveField("start"); }} className="text-xs font-semibold text-gray-500 hover:text-red-600">Reset tanggal</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-gray-900">Tutup</button>
          </div>
        </div>
      )}
      {(!startDate || !endDate) && <p className="mt-2 text-xs text-gray-500">Pilih tanggal mulai, lalu tanggal selesai.</p>}
    </div>
  );
}
