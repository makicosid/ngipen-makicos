"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AdItem = { id: string; slot: "banner" | "floating" | "popup"; name: string; imageUrl: string; targetUrl: string; sponsorName?: string };
type Props = { slot: "banner" | "floating" | "popup"; className?: string };

export default function AdvertisingSlot({ slot, className = "" }: Props) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const tracked = useRef(new Set<string>());
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRepeatTimer = useRef<number | undefined>(undefined);

  const track = useCallback(async (ad: AdItem, eventType: "impression" | "click") => {
    const key = crypto.randomUUID();
    try {
      await fetch("/api/advertising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ campaignId: ad.id, eventType, eventKey: key, pagePath: window.location.pathname }),
      });
    } catch {
      // Ad display must remain available even when analytics is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let popupInitialTimer: number | undefined;
    let floatingInitialTimer: number | undefined;
    fetch(`/api/advertising?slot=${slot}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Ad request failed")))
      .then(result => {
        if (cancelled || !Array.isArray(result.ads)) return;
        const next = result.ads as AdItem[];
        setAds(next);
        if (slot === "popup" && next.length) {
          popupInitialTimer = window.setTimeout(() => {
            if (!cancelled) setPopupOpen(true);
          }, 1000);
        }
        if (slot === "floating" && next.length) {
          floatingInitialTimer = window.setTimeout(() => {
            if (!cancelled) setFloatingVisible(true);
          }, 5000);
        }
      })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => {
      cancelled = true;
      if (popupInitialTimer !== undefined) window.clearTimeout(popupInitialTimer);
      if (floatingInitialTimer !== undefined) window.clearTimeout(floatingInitialTimer);
      if (popupRepeatTimer.current !== undefined) {
        window.clearTimeout(popupRepeatTimer.current);
        popupRepeatTimer.current = undefined;
      }
    };
  }, [slot]);

  useEffect(() => {
    if (!ads.length || slot === "popup" || !rootRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      for (const ad of ads) {
        if (tracked.current.has(ad.id)) continue;
        tracked.current.add(ad.id);
        void track(ad, "impression");
      }
    }, { threshold: 0.5 });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [ads, slot, track]);

  useEffect(() => {
    if (slot !== "popup" || !popupOpen || !ads[0] || tracked.current.has(ads[0].id)) return;
    tracked.current.add(ads[0].id);
    void track(ads[0], "impression");
  }, [ads, popupOpen, slot, track]);

  if (!ads.length) return null;

  const openAd = (ad: AdItem) => {
    void track(ad, "click");
    window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
  };

  const closePopup = () => {
    setPopupOpen(false);
    if (popupRepeatTimer.current !== undefined) window.clearTimeout(popupRepeatTimer.current);
    popupRepeatTimer.current = window.setTimeout(() => setPopupOpen(true), 45000);
  };

  if (slot === "popup") {
    if (!popupOpen) return null;
    const ad = ads[0];
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Iklan partner">
        <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <button type="button" onClick={closePopup} aria-label="Tutup iklan" className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-xl text-white">×</button>
          <button type="button" onClick={() => openAd(ad)} className="block w-full text-left">
            <img src={ad.imageUrl} alt={ad.name} className="max-h-[65dvh] w-full object-contain" />
          </button>
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Iklan Partner</p><p className="truncate text-sm font-bold">{ad.sponsorName || ad.name}</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={closePopup} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Tutup</button>
              <button type="button" onClick={() => openAd(ad)} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white">Lihat</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slot === "floating") {
    if (!floatingVisible) return null;
    return (
      <div ref={rootRef} className={`fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-3 sm:p-6 ${className}`} role="dialog" aria-modal="true" aria-label="Iklan partner">
        <div className="relative flex max-h-[96dvh] w-full max-w-5xl flex-col items-end justify-center gap-2 pt-14">
          <button type="button" onClick={() => setAds([])} aria-label="Tutup iklan" title="Tutup iklan" className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-red-600 text-3xl font-black leading-none text-white shadow-xl ring-2 ring-red-950/70 transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-300">×</button>
          {ads.map(ad => (
            <button key={ad.id} type="button" onClick={() => openAd(ad)} className="flex max-h-[calc(94dvh-4rem)] w-full items-center justify-center">
              <img src={ad.imageUrl} alt={ad.name} loading="lazy" className="max-h-[calc(94dvh-4rem)] max-w-full rounded-xl object-contain shadow-2xl" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const bannerAd = ads[0];

  return (
    <section ref={rootRef} className={`mx-auto w-full max-w-[1400px] px-4 pb-5 ${className}`} aria-label="Iklan partner">
      {bannerAd && (
        <button
          type="button"
          onClick={() => openAd(bannerAd)}
          className="group relative block w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
        >
          <img
            src={bannerAd.imageUrl}
            alt={bannerAd.name}
            loading="lazy"
            className="mx-auto block h-auto max-h-36 w-full object-contain sm:max-h-48 md:max-h-56"
          />
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Iklan Partner</span>
        </button>
      )}
    </section>
  );
}
