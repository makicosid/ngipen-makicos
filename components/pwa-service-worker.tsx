"use client";

import { useEffect } from "react";
import { getFirebaseApp } from "@/lib/firebase/client";

export default function PwaServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerWorker = async () => {
      try {
        const config = getFirebaseApp().options;
        const workerUrl = new URL("/firebase-messaging-sw.js", window.location.origin);

        for (const [key, value] of Object.entries({
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId,
          storageBucket: config.storageBucket,
          messagingSenderId: config.messagingSenderId,
          appId: config.appId,
        })) {
          if (value) workerUrl.searchParams.set(key, String(value));
        }

        await navigator.serviceWorker.register(workerUrl.toString(), { scope: "/" });
      } catch (error) {
        console.error("NGIPEN service worker registration failed:", error);
      }
    };

    void registerWorker();
  }, []);

  return null;
}
