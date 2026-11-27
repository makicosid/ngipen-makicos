"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AdItem = { id: string; slot: "banner" | "floating" | "popup"; name: string; imageUrl: string; targetUrl: string; sponsorName?: string };
type Props = { slot: "banner" | "floating" | "popup"; className?: string };

export default function AdvertisingSlot({ slot, className = "" }: Props) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [popupOpen, setPopupOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const tracked = useRef(new Set<string>());
  const rootRef = useRef<HTMLDivElement>(null);

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
    fetch(`/api/advertising?slot=${slot}`, { cache: "no-store" })
      .then(response => response.ok ? response.json() : Promise.reject(new Error("Ad request failed")))
      .then(result => {
        if (cancelled || !Array.isArray(result.ads)) return;
        const next = result.ads as AdItem[];
        setAds(next);
        if (slot === "popup" && next.length) {
          let alreadySeen = false;
          try {
            alreadySeen = sessionStorage.getItem("ngipen_popup_seen") === "1";
          } catch {
            // If storage is unavailable, keep the popup usable for this page view.
          }
          if (!alreadySeen) {
            const popupTimer = window.setTimeout(() => {
              if (cancelled) return;
              try {
                sessionStorage.setItem("ngipen_popup_seen", "1");
              } catch {
                // The popup can still be displayed when session storage is blocked.
              }
              setPopupOpen(true);
            }, 5000);
            return () => {
              cancelled = true;
              window.clearTimeout(popupTimer);
            };
          }
        }
      })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => { cancelled = true; };
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

  if (slot === "popup") {
    if (!popupOpen || dismissed) return null;
    const ad = ads[0];
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/65 p-4" role="dialog" aria-modal="true" aria-label="Iklan partner">
        <div className="relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <button type="button" onClick={() => { setDismissed(true); setPopupOpen(false); }} aria-label="Tutup iklan" className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-xl text-white">×</button>
          <button type="button" onClick={() => openAd(ad)} className="block w-full text-left">
            <img src={ad.imageUrl} alt={ad.name} className="max-h-[65dvh] w-full object-contain" />
          </button>
          <div className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Iklan Partner</p><p className="truncate text-sm font-bold">{ad.sponsorName || ad.name}</p></div><button type="button" onClick={() => openAd(ad)} className="shrink-0 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white">Lihat</button></div>
        </div>
      </div>
    );
  }

  if (slot === "floating") {
    return <div ref={rootRef} className={`fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-3 z-[60] w-36 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl sm:bottom-5 sm:right-5 sm:w-44 dark:border-gray-700 dark:bg-gray-900 ${className}`}>
      <div className="flex items-center justify-between px-2 py-1"><span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Partner</span><button type="button" onClick={() => setAds([])} aria-label="Tutup iklan" className="text-sm text-gray-500">×</button></div>
      {ads.map(ad => <button key={ad.id} type="button" onClick={() => openAd(ad)} className="block w-full"><img src={ad.imageUrl} alt={ad.name} loading="lazy" className="max-h-32 w-full object-contain" /></button>)}
    </div>;
  }

  return <section ref={rootRef} className={`mx-auto w-full max-w-[1400px] px-4 pb-5 ${className}`} aria-label="Iklan partner">
    <div className="grid gap-3 sm:grid-cols-2">{ads.map(ad => <button key={ad.id} type="button" onClick={() => openAd(ad)} className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"><img src={ad.imageUrl} alt={ad.name} loading="lazy" className="max-h-48 w-full object-contain sm:max-h-56" /><span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Iklan Partner</span></button>)}</div>
  </section>;
}
