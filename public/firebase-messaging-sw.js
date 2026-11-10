/* NGIPEN PWA + Firebase Cloud Messaging service worker. Keep at web root. */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

const CACHE_NAME = "ngipen-static-v1";
const OFFLINE_URL = "/offline.html";
const STATIC_PREFIX = "/_next/static/";

const configParams = new URL(self.location.href).searchParams;
const firebaseConfig = {
  apiKey: configParams.get("apiKey") || "",
  authDomain: configParams.get("authDomain") || "",
  projectId: configParams.get("projectId") || "",
  storageBucket: configParams.get("storageBucket") || "",
  messagingSenderId: configParams.get("messagingSenderId") || "",
  appId: configParams.get("appId") || "",
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("ngipen-static-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // Cache only versioned Next.js build assets. Never cache API or user-specific HTML/data.
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("", { status: 503, statusText: "Offline" });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })());
  }
});

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "NGIPEN";
  const options = {
    body: payload.data?.body || "Ada informasi terbaru untukmu.",
    icon: "/logo.png",
    badge: "/favicon.svg",
    data: { url: payload.data?.url || "/" },
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedTarget = new URL(event.notification.data?.url || "/", self.location.origin);
  const target = requestedTarget.origin === self.location.origin ? requestedTarget.href : self.location.origin + "/";
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    await self.clients.openWindow(target);
  })());
});
