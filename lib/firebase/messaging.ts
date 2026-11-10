"use client";

import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "./client";

export async function requestAndRegisterPushToken(): Promise<string> {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("Browser ini belum mendukung notifikasi web.");
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error("Firebase VAPID key belum dikonfigurasi.");

  const messaging = await getFirebaseMessaging();
  if (!messaging) throw new Error("Firebase Messaging tidak didukung browser ini.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Izin notifikasi ditolak. Aktifkan melalui pengaturan browser."
        : "Izin notifikasi belum diberikan."
    );
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
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
      title: payload.notification?.title || "NGIPEN",
      body: payload.notification?.body || "Ada informasi terbaru untukmu.",
    });
  });
}
