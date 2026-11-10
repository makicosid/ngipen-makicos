/* Firebase Cloud Messaging service worker. Keep this file at the web root. */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

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

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || "NGIPEN";
  const options = {
    body: payload.data?.body || "Ada informasi terbaru untukmu.",
    icon: "/logo.png",
    badge: "/favicon.svg",
    data: { url: payload.data?.url || "/" },
  };
  self.registration.showNotification(title, options);
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
