"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isEventPosterAdPauseActive, subscribeToEventPosterAdPause } from "../lib/ad-pause";

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

const BANNER_CLOSE_DELAY_MS = 35_000;
const POPUP_REPEAT_DELAY_MS = 100_000;
const FLOATING_INITIAL_DELAY_MS = 8_000;
const FLOATING_REPEAT_DELAY_MS = 60_000;

export default function AdvertisingSlot({ slot, className = "" }: Props) {
  const [ads, setAds] = useState<AdItem[]>([]);
  const [adsPaused, setAdsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupClosing, setPopupClosing] = useState(false);
  const [floatingVisible, setFloatingVisible] = useState(false);
  const [floatingFinished, setFloatingFinished] = useState(false);
  const [bannerOutOfView, setBannerOutOfView] = useState(false);
  const [bannerCloseVisible, setBannerCloseVisible] = useState(false);
  const [bannerClosing, setBannerClosing] = useState(false);
  const [dismissedBannerCreative, setDismissedBannerCreative] = useState<string | null>(null);
  const [navbarOffset, setNavbarOffset] = useState(0);
  const tracked = useRef(new Set<string>());
  const rootRef = useRef<HTMLElement>(null);
  const bannerCloseTimer = useRef<number | undefined>(undefined);
  const bannerCloseAnimationTimer = useRef<number | undefined>(undefined);
  const bannerNextTimer = useRef<number | undefined>(undefined);
  const popupRepeatTimer = useRef<number | undefined>(undefined);
  const popupCloseTimer = useRef<number | undefined>(undefined);
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
          initialTimer = window.setTimeout(() => { if (!cancelled) setFloatingVisible(true); }, FLOATING_INITIAL_DELAY_MS);
        }
      })
      .catch(() => { if (!cancelled) setAds([]); });
    return () => {
      cancelled = true;
      if (initialTimer !== undefined) window.clearTimeout(initialTimer);
      if (popupRepeatTimer.current !== undefined) window.clearTimeout(popupRepeatTimer.current);
      if (popupCloseTimer.current !== undefined) window.clearTimeout(popupCloseTimer.current);
      if (floatingNextTimer.current !== undefined) window.clearTimeout(floatingNextTimer.current);
      if (bannerCloseTimer.current !== undefined) window.clearTimeout(bannerCloseTimer.current);
      if (bannerCloseAnimationTimer.current !== undefined) window.clearTimeout(bannerCloseAnimationTimer.current);
      if (bannerNextTimer.current !== undefined) window.clearTimeout(bannerNextTimer.current);
    };
  }, [slot]);

  useEffect(() => {
    setAdsPaused(isEventPosterAdPauseActive());
    return subscribeToEventPosterAdPause(setAdsPaused);
  }, []);

  const currentAd = ads.length ? ads[currentIndex % ads.length] : undefined;
  const currentBannerKey = currentAd ? (currentAd.creativeId || currentAd.id) : null;
  const bannerFloatingActive = slot === "banner" && !!currentAd && bannerOutOfView &&
    dismissedBannerCreative !== currentBannerKey && !bannerClosing;

  useEffect(() => {
    if (slot !== "banner" || !rootRef.current) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      setBannerOutOfView(!entry.isIntersecting);
    }, { threshold: 0 });
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [slot, ads.length]);

  useEffect(() => {
    if (slot !== "banner" || !bannerFloatingActive) {
      setBannerCloseVisible(false);
      if (bannerCloseTimer.current !== undefined) window.clearTimeout(bannerCloseTimer.current);
      return;
    }
    setBannerCloseVisible(false);
    if (bannerCloseTimer.current !== undefined) window.clearTimeout(bannerCloseTimer.current);
    bannerCloseTimer.current = window.setTimeout(() => setBannerCloseVisible(true), 5000);
    return () => {
      if (bannerCloseTimer.current !== undefined) window.clearTimeout(bannerCloseTimer.current);
    };
  }, [slot, bannerFloatingActive, currentBannerKey]);

  useEffect(() => {
    if (slot !== "banner") return;
    const updateNavbarOffset = () => {
      let bottom = 0;
      const candidates = document.querySelectorAll<HTMLElement>("header, nav, [role='navigation'], [data-navbar]");
      candidates.forEach(element => {
        const style = window.getComputedStyle(element);
        if (style.position !== "fixed" && style.position !== "sticky") return;
        const rect = element.getBoundingClientRect();
        if (rect.top <= 8 && rect.bottom > bottom && rect.bottom > 0) bottom = rect.bottom;
      });
      setNavbarOffset(Math.max(0, Math.round(bottom)));
    };
    updateNavbarOffset();
    window.addEventListener("scroll", updateNavbarOffset, { passive: true });
    window.addEventListener("resize", updateNavbarOffset);
    return () => {
      window.removeEventListener("scroll", updateNavbarOffset);
      window.removeEventListener("resize", updateNavbarOffset);
    };
  }, [slot]);

  const closeBannerFloating = () => {
    if (!currentBannerKey || bannerClosing) return;
    setBannerCloseVisible(false);
    setBannerClosing(true);
    if (bannerCloseAnimationTimer.current !== undefined) window.clearTimeout(bannerCloseAnimationTimer.current);
    bannerCloseAnimationTimer.current = window.setTimeout(() => {
      setDismissedBannerCreative(currentBannerKey);
      setBannerClosing(false);
      if (bannerNextTimer.current !== undefined) window.clearTimeout(bannerNextTimer.current);
      bannerNextTimer.current = window.setTimeout(() => {
        setCurrentIndex(index => (index + 1) % Math.max(1, ads.length));
        setDismissedBannerCreative(null);
      }, BANNER_CLOSE_DELAY_MS);
    }, 320);
  };

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
    setPopupClosing(true);
    if (popupCloseTimer.current !== undefined) window.clearTimeout(popupCloseTimer.current);
    popupCloseTimer.current = window.setTimeout(() => {
      setPopupOpen(false);
      setPopupClosing(false);
    }, 260);
    if (popupRepeatTimer.current !== undefined) window.clearTimeout(popupRepeatTimer.current);
    popupRepeatTimer.current = window.setTimeout(() => {
      setCurrentIndex(index => (index + 1) % Math.max(1, ads.length));
      setPopupClosing(false);
      setPopupOpen(true);
    }, POPUP_REPEAT_DELAY_MS);
  };

  const closeFloating = () => {
    setFloatingVisible(false);
    if (floatingNextTimer.current !== undefined) window.clearTimeout(floatingNextTimer.current);
    floatingNextTimer.current = window.setTimeout(() => {
      setCurrentIndex(index => (index + 1) % Math.max(1, ads.length));
      setFloatingFinished(false);
      setFloatingVisible(true);
    }, FLOATING_REPEAT_DELAY_MS);
  };

  if (!ads.length || adsPaused) return null;

  if (slot === "popup") {
    if ((!popupOpen && !popupClosing) || !currentAd) return null;
    return (
      <div className={`ad-popup-overlay fixed inset-0 z-[120] flex items-center justify-center overflow-y-auto bg-black/70 p-4 ${popupClosing ? "ad-popup-overlay--closing" : ""}`} role="dialog" aria-modal="true" aria-label="Iklan partner">
        <div className={`ad-popup-panel relative my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900 ${popupClosing ? "ad-popup-panel--closing" : ""}`}>
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
        className={`ad-floating-enter fixed right-3 top-[30%] z-[110] w-[min(160px,calc(100vw-24px))] overflow-visible sm:right-5 md:w-[240px] ${className}`}
        aria-label="Iklan partner"
      >
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex min-h-7 items-center justify-between gap-2 px-2 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Iklan Partner</span>
            <button
              type="button"
              onClick={closeFloating}
              aria-label="Tutup iklan"
              title="Tutup iklan"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base font-bold leading-none text-gray-700 transition hover:bg-red-100 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-red-950"
            >
              ×
            </button>
          </div>
          <button
            type="button"
            onClick={() => openAd(currentAd)}
            className="block w-full bg-white p-1 text-left dark:bg-gray-900"
            aria-label={`Buka iklan ${currentAd.name}`}
          >
            <img
              src={currentAd.imageUrl}
              alt={currentAd.name}
              loading="lazy"
              className="mx-auto block aspect-square max-h-[160px] w-full rounded-md object-contain md:max-h-[240px]"
            />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <>
      <section ref={rootRef} className={`mx-auto w-full max-w-[1400px] px-4 pb-5 ${className}`} aria-label="Banner iklan">
        {currentAd && (
          <>
            <button key={currentAd.creativeId || currentAd.id} type="button" onClick={() => openAd(currentAd)} className="ad-banner-slide-in group relative block w-full overflow-hidden rounded-xl border border-gray-200 bg-white text-left shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
              <img src={currentAd.imageUrl} alt={currentAd.name} loading="lazy" className="mx-auto block h-auto max-h-36 w-full object-contain sm:max-h-48 md:max-h-56" />
            </button>
            {ads.length > 1 && (
              <div className="mt-2 flex items-center justify-center gap-2" aria-label="Pilih banner iklan">
                {ads.map((ad, index) => (
                  <button
                    key={ad.creativeId || ad.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    aria-label={`Tampilkan banner ${index + 1}`}
                    aria-current={index === currentIndex ? "true" : undefined}
                    className="h-2 flex-1 max-w-20 overflow-hidden rounded-full bg-gray-200 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:bg-gray-700 dark:hover:bg-gray-600"
                  >
                    <span className={`block h-full rounded-full ${index === currentIndex ? "ad-banner-indicator-fill bg-red-600" : "w-0"}`} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {slot === "banner" && bannerOutOfView && currentAd && dismissedBannerCreative !== currentBannerKey && (
        <div
          className="ad-banner-floating-shell fixed left-0 right-0 z-[105] mx-auto w-full max-w-[1400px] px-4"
          style={{ top: navbarOffset }}
          aria-label="Banner iklan"
        >
          <div className={`ad-banner-floating-card overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 ${bannerClosing ? "ad-banner-floating-card--closing" : ""}`}>
            <button
              type="button"
              onClick={() => openAd(currentAd)}
              className="block w-full text-left"
              aria-label={`Buka iklan ${currentAd.name}`}
            >
              <img
                src={currentAd.imageUrl}
                alt={currentAd.name}
                className="mx-auto block h-auto max-h-24 w-full object-contain sm:max-h-32 md:max-h-40"
              />
            </button>
          </div>
          {bannerCloseVisible && !bannerClosing && (
            <button
              type="button"
              onClick={closeBannerFloating}
              aria-label="Tutup banner iklan"
              title="Tutup banner"
              className="ad-banner-floating-close mx-auto flex h-7 w-10 items-center justify-center rounded-b-lg border border-t-0 border-gray-300 bg-white text-lg font-bold leading-none text-gray-700 shadow-md hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-red-950"
            >
              ×
            </button>
          )}
        </div>
      )}
    </>
  );
}
