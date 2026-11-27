const STORAGE_KEY = "ngipen:event-poster-ad-pause";
const EVENT_NAME = "ngipen:ad-pause-change";

function notifyPauseChange(paused: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, paused ? "1" : "0");
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { paused } }));
}

export function pauseAdsForEventPosterUpload() {
  notifyPauseChange(true);
}

export function resumeAdsAfterEventPosterUpload() {
  notifyPauseChange(false);
}

export function isEventPosterAdPauseActive() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function subscribeToEventPosterAdPause(callback: (paused: boolean) => void) {
  if (typeof window === "undefined") return () => {};
  const onCustom = (event: Event) => {
    callback(Boolean((event as CustomEvent<{ paused?: boolean }>).detail?.paused));
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback(event.newValue === "1");
  };
  window.addEventListener(EVENT_NAME, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
