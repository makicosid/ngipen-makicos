/* Firebase Cloud Messaging service worker. Keep this file at the web root. */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: self.NGIPEN_FIREBASE_API_KEY || "",
  authDomain: self.NGIPEN_FIREBASE_AUTH_DOMAIN || "",
  projectId: self.NGIPEN_FIREBASE_PROJECT_ID || "",
  messagingSenderId: self.NGIPEN_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: self.NGIPEN_FIREBASE_APP_ID || "",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "NGIPEN";
  const options = {
    body: payload.notification?.body || "Ada informasi terbaru untukmu.",
    icon: "/logo.png",
    badge: "/favicon.svg",
    data: { url: payload.data?.url || "/" },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
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
