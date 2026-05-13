/// <reference lib="webworker" />
/* eslint-disable */
// Custom service worker for the Bioalergia intranet PWA.
//
// vite-plugin-pwa is configured with `strategies: "injectManifest"`,
// which means THIS file is the source of truth for SW behaviour:
//
//   1. Workbox precache + runtime cache
//   2. Web Push receipt + notification display
//   3. Notification click → focus the app or open the deep-linked URL
//
// The auto-generated `generateSW` mode does (1) only — push events
// arrive at the SW but never become OS notifications. That's why the
// Mac/iPhone smoke tests previously reported `success: true, sent: 2`
// but no banner appeared anywhere.

import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Precache + runtime cache ────────────────────────────────────────────────
// `globPatterns: []` (set in vite.config.ts) means __WB_MANIFEST is
// usually empty. Calling precacheAndRoute([]) still tries to register
// a navigation handler that maps to a non-existent `index.html` and
// throws "non-precached-url" at SW startup. The unhandled rejection
// aborts SW activation before our `push` listener registers — exactly
// the symptom Safari Web Inspector showed (workbox-XXXX.js stack
// trace + push events handled without showNotification). Skip the
// precache call entirely when the manifest is empty.
if (Array.isArray(self.__WB_MANIFEST) && self.__WB_MANIFEST.length > 0) {
  precacheAndRoute(self.__WB_MANIFEST);
}
cleanupOutdatedCaches();

// Take over the page on first install so we don't have to wait for
// every tab to close before the new SW runs. Without this, the
// previous generateSW worker keeps handling `push` events and
// silently drops them (the OS-level error in the SW console reads
// "Push event handling completed without showing any notification…"
// because the OLD worker has no push handler).
self.addEventListener("install", () => {
  void self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages-cache",
    networkTimeoutSeconds: 3,
  })
);
registerRoute(
  ({ request }) =>
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font",
  new StaleWhileRevalidate({ cacheName: "static-cache" })
);

// ─── Push notification receipt ────────────────────────────────────────────────
// Payload shape mirrors what apps/api/src/services/notifications.ts
// dispatches: { title, body, icon, tag, data: { url } }. We tolerate
// missing fields so a malformed payload still renders something.
self.addEventListener("push", (event) => {
  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    tag?: string;
    data?: { url?: string };
  } = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Bioalergia", body: event.data.text() };
    }
  }
  const title = payload.title ?? "Bioalergia";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? "",
      icon: payload.icon ?? "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: payload.tag,
      data: payload.data ?? {},
      // `renotify` is in the spec but not in lib.dom NotificationOptions
      // yet; cast to bypass the missing field while keeping runtime
      // behaviour. Keeps the OS pinging on every new message in an
      // already-open conversation.
      ...({ renotify: !!payload.tag } as Record<string, unknown>),
    })
  );
});

// ─── Click → focus / open ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data as { url?: string })?.url ?? "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an existing tab if one already has the app open.
      for (const c of all) {
        try {
          const url = new URL(c.url);
          if (url.origin === self.location.origin) {
            await c.focus();
            if ("navigate" in c) {
              await (c as WindowClient).navigate(target);
            }
            return;
          }
        } catch {
          // ignore
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});

// Allow the app to skipWaiting from main thread when a new SW
// version is served (vite-plugin-pwa's prompt flow uses this).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
