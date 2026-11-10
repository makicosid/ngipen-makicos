"use client";

import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseApp, getFirebaseMessaging } from "./client";

export async function requestAndRegisterPushToken(): Promise<string> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Browser ini belum mendukung notifikasi web.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Firebase VAPID key belum dikonfigurasi.");

  // Request permission immediately inside the click handler to preserve user activation.
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Izin notifikasi ditolak. Aktifkan melalui pengaturan browser."
        : "Izin notifikasi belum diberikan."
    );
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) throw new Error("Firebase Messaging tidak didukung browser ini.");

  const config = getFirebaseApp().options;
  const serviceWorkerUrl = new URL("/firebase-messaging-sw.js", window.location.origin);
  for (const [key, value] of Object.entries({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  })) {
    if (value) serviceWorkerUrl.searchParams.set(key, String(value));
  }

  const registration = await navigator.serviceWorker.register(serviceWorkerUrl.toString());
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Token perangkat belum berhasil dibuat.");
  return token;
}

export async function listenForForegroundMessages(
  onNotification: (payload: { title: string; body: string }) => void
) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return () => undefined;

  return onMessage(messaging, (payload) => {
    onNotification({
      title: payload.data?.title || payload.notification?.title || "NGIPEN",
      body: payload.data?.body || payload.notification?.body || "Ada informasi terbaru untukmu.",
    });
  });
}
