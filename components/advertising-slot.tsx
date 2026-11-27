"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AdItem = {
  id: string;
  campaignId: string;
  creativeId?: string | null;
  sponsorId: string;
  slot: "banner" | "floating" | "popup";
  name: string;
  imageUrl: string;
  targetUrl: string;
  sponsorName?: string;
  sortOrder?: number;
};
type Props = { slot: "banner" | "floating" | "popup"; className?: string };

const ROTATION_MS = 60_000;
const BANNER_ROTATION_MS = 25_000;
const FLOATING_CLOSE_DELAY_MS = 60_000;

export default function AdvertisingSlot({ slot, className = "" }: Props) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const [floatingFinished, setFloatingFinished] = useState(false);
  const tracked = useRef(new Set<string>());
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRepeatTimer = useRef<number | undefined>(undefined);
  const floatingNextTimer = useRef<number | undefined>(undefined);

  const track = useCallback(async (ad: AdItem, eventType: "impression" | "click") => {
    const key = crypto.randomUUID();
    try {
      await fetch("/api/advertising", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          campaignId: ad.campaignId || ad.id,
          creativeId: ad.creativeId || null,
          eventType,
          eventKey: key,
          pagePath: window.location.pathname,
        }),
      });
    } catch {
      // Keep the ad experience available if analytics is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let initialTimer: number | undefined;
    fetch(`/api/advertising?slot=${slot}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Ad request failed")))
      .then(result => {
        if (cancelled || !Array.isArray(result.ads)) return;
        setAds(result.ads as AdItem[]);
        if (slot === "popup" && result.ads.length) {
          initialTimer = window.setTimeout(() => { if (!cancelled) setPopupOpen(true); }, 1000);
        }
        if (slot === "floating" && result.ads.length) {
          initialTimer = window.setTimeout(() => { if (!cancelled) setFloatingVisible(true); }, 5000);
        }
      })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => {
      cancelled = true;
      if (initialTimer !== undefined) window.clearTimeout(initialTimer);
      if (popupRepeatTimer.current !== undefined) window.clearTimeout(popupRepeatTimer.current);
      if (floatingNextTimer.current !== undefined) window.clearTimeout(floatingNextTimer.current);
    };
  }, [slot]);

  useEffect(() => {
    if (ads.length < 2 || slot === "floating") return;
    const interval = slot === "banner" ? BANNER_ROTATION_MS : ROTATION_MS;
    const timer = window.setInterval(() => setCurrentIndex(index => (index + 1) % ads.length), interval);
    return () => window.clearInterval(timer);
  }, [ads.length, slot]);

  const currentAd = ads.length ? ads[currentIndex % ads.length] : undefined;

  useEffect(() => {
    if (!currentAd || slot === "popup" || !rootRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      const key = currentAd.creativeId || currentAd.id;
      if (tracked.current.has(key)) return;
      tracked.current.add(key);
      void track(currentAd, "impression");
    }, { threshold: 0.5 });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [currentAd, slot, track]);

  useEffect(() => {
    if (slot !== "popup" || !popupOpen || !currentAd) return;
    const key = currentAd.creativeId || currentAd.id;
    if (tracked.current.has(key)) return;
    tracked.current.add(key);
    void track(currentAd, "impression");
  }, [currentAd, popupOpen, slot, track]);

  const openAd = (ad: AdItem) => {
    void track(ad, "click");
    window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
  };

  const closePopup = () => {
    setPopupOpen(false);
    if (popupRepeatTimer.current !== undefined) window.clearTimeout(popupRepeatTimer.current);
    popupRepeatTimer.current = window.setTimeout(() => setPopupOpen(true), 45_000);
  };

  const closeFloating = () => {
    setFloatingVisible(false);
    if (floatingNextTimer.current !== undefined) window.clearTimeout(floatingNextTimer.current);
    floatingNextTimer.current = window.setTimeout(() => {
      const next = currentIndex + 1;
      if (next >= ads.length) {
        setFloatingFinished(true);
        return;
      }
      setCurrentIndex(next);
      setFloatingVisible(true);
    }, FLOATING_CLOSE_DELAY_MS);
  };

  if (!ads.length) return null;

  if (slot === "popup") {
    if (!popupOpen || !currentAd) return null;
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Iklan partner">
        <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <button type="button" onClick={closePopup} aria-label="Tutup iklan" className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-xl text-white">×</button>
          <button type="button" onClick={() => openAd(currentAd)} className="block w-full text-left">
            <img src={currentAd.imageUrl} alt={currentAd.name} className="max-h-[65dvh] w-full object-contain" />
          </button>
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Iklan Partner</p><p className="truncate text-sm font-bold">{currentAd.sponsorName || currentAd.name}</p></div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={closePopup} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">Tutup</button>
              <button type="button" onClick={() => openAd(currentAd)} className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white">Lihat</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (slot === "floating") {
    if (!floatingVisible || floatingFinished || !currentAd) return null;
    return (
      <aside
        ref={rootRef}
        className={`fixed bottom-2 right-2 z-[110] w-[min(24px,calc(100vw-16px))] overflow-visible sm:bottom-2 sm:right-2 sm:w-[32px] md:w-[48px] ${className}`}
        aria-label="Iklan partner"
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex min-h-3 items-center justify-between gap-0.5 px-0.5 py-0.5">
            <span className="text-[4px] font-bold uppercase tracking-wider text-gray-500">Iklan Partner</span>
            <button
              type="button"
              onClick={closeFloating}
              aria-label="Tutup iklan"
              title="Tutup iklan"
              className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold leading-none text-gray-700 transition hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-red-950"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={() => openAd(currentAd)}
            className="block w-full bg-white p-0.5 text-left dark:bg-gray-900"
            aria-label={`Buka iklan ${currentAd.name}`}
          >
            <img
              src={currentAd.imageUrl}
              alt={currentAd.name}
              loading="lazy"
              className="mx-auto block aspect-square max-h-[24px] w-full rounded-md object-contain sm:max-h-[32px] md:max-h-[48px]"
            />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <section ref={rootRef} className={`mx-auto w-full max-w-[1400px] px-4 pb-5 ${className}`} aria-label="Iklan partner">
      {currentAd && (
        <button type="button" onClick={() => openAd(currentAd)} className="group relative block w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
          <img src={currentAd.imageUrl} alt={currentAd.name} loading="lazy" className="mx-auto block h-auto max-h-36 w-full object-contain sm:max-h-48 md:max-h-56" />
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Iklan Partner</span>
        </button>
      )}
    </section>
  );
}
