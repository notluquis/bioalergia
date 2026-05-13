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

import { cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Precache + runtime cache ────────────────────────────────────────────────
// We DO NOT call precacheAndRoute. With `globPatterns: []` the
// manifest is empty anyway, and calling it side-effect-registers a
// navigation handler that maps every nav request to the non-existent
// `index.html`, throwing "non-precached-url" at SW startup. The
// unhandled rejection aborts SW activation before the push listener
// gets registered (the symptom Safari Web Inspector showed:
// workbox-XXXX.js stack trace + "Push event handling completed
// without showing any notification"). Even importing
// precacheAndRoute pulls createHandlerBoundToURL into the bundle, so
// we drop the import entirely.
//
// injectManifest still asserts that `self.__WB_MANIFEST` appears
// EXACTLY ONCE in the source — we touch it via void in a single
// reference so the build pipeline is satisfied without using the
// value at runtime.
void self.__WB_MANIFEST;
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
// dispatches: { title, body, icon, image, tag, badgeCount, timestamp,
// data: { url, badgeCount } }. We tolerate missing fields so a
// malformed payload still renders something.
self.addEventListener("push", (event) => {
  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    image?: string;
    tag?: string;
    badgeCount?: number;
    timestamp?: number;
    data?: { url?: string; badgeCount?: number };
  } = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Bioalergia", body: event.data.text() };
    }
  }
  const title = payload.title ?? "Bioalergia";
  // Run notification + badge update in parallel; event.waitUntil
  // keeps the SW alive until both promises settle so the OS doesn't
  // consider the push event "completed without showing notification".
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: payload.body ?? "",
        icon: payload.icon ?? "/icons/icon-192.png",
        badge: "/icons/icon-72.png",
        tag: payload.tag,
        data: payload.data ?? {},
        // `image`, `timestamp`, `renotify`, `vibrate` are in the spec
        // but not all in lib.dom. Cast keeps TS happy while the OS
        // (Chromium / iOS 16.4+) honours each one when available.
        ...({
          image: payload.image,
          timestamp: payload.timestamp ?? Date.now(),
          renotify: !!payload.tag,
          // Two short pulses → standard messaging app feel on Android.
          vibrate: [200, 100, 200],
        } as Record<string, unknown>),
      }),
      // Badging API (Chromium + Safari iOS 16.4+ + macOS PWAs). Falls
      // back silently when the runtime doesn't expose it.
      (async () => {
        type BadgeNav = Navigator & {
          setAppBadge?: (n?: number) => Promise<void>;
          clearAppBadge?: () => Promise<void>;
        };
        const nav = (self as unknown as { navigator: BadgeNav }).navigator;
        const count = payload.badgeCount ?? payload.data?.badgeCount;
        try {
          if (typeof count === "number" && count > 0) {
            await nav.setAppBadge?.(count);
          } else {
            await nav.clearAppBadge?.();
          }
        } catch {
          // Older PWAs / Firefox throw; we already showed the
          // notification so the operator still sees the activity.
        }
      })(),
    ])
  );
});

// ─── Click → focus / open ─────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = (event.notification.data as { url?: string }) ?? {};
  const target = data.url ?? "/";
  // Close every other notification with the same tag so opening a
  // conversation clears its stack from the OS notification center.
  // Without this the operator still sees three "Juan Pérez" banners
  // after tapping one and replying.
  const tag = event.notification.tag;
  event.waitUntil(
    (async () => {
      if (tag) {
        const same = await self.registration.getNotifications({ tag });
        for (const n of same) n.close();
      }
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
