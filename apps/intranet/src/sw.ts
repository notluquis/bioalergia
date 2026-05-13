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

import { cleanupOutdatedCaches, matchPrecache, precache } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// ─── Precache + runtime cache ────────────────────────────────────────────────
// `precache()` (NOT `precacheAndRoute`) installs the shell into Cache
// Storage WITHOUT registering Workbox's auto navigation route. We
// keep manual control over routing — the NetworkFirst below handles
// fresh navigations and `setCatchHandler` falls back to the cached
// shell when offline. Calling precacheAndRoute here would prepend a
// navigation handler that beats our NetworkFirst (Workbox matches
// first registered) and serve stale shell on every nav.
precache(self.__WB_MANIFEST);
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

// Last-resort offline fallback for any navigation that bypasses the
// NetworkFirst route or fails to hit the cache (cold load, no
// network). Serves the precached SPA shell so the operator at least
// sees the app chrome instead of the browser's offline page.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    // Workbox stores precached entries with a revision query param
    // (e.g. /index.html?__WB_REVISION__=abc). matchPrecache resolves
    // the right cache key automatically.
    const shell = await matchPrecache("/index.html");
    if (shell) return shell;
  }
  return Response.error();
});

// ─── Push notification receipt ────────────────────────────────────────────────
// Payload shape mirrors what apps/api/src/services/notifications.ts
// dispatches: { title, body, icon, image, tag, badgeCount, timestamp,
// kind, requireInteraction, silent, data: { url, badgeCount } }. We
// tolerate missing fields so a malformed payload still renders
// something.
self.addEventListener("push", (event) => {
  let payload: {
    title?: string;
    body?: string;
    icon?: string;
    image?: string;
    tag?: string;
    badgeCount?: number;
    timestamp?: number;
    requireInteraction?: boolean;
    silent?: boolean;
    kind?: "notification" | "data";
    actions?: Array<{ action: string; title: string; icon?: string }>;
    data?: { url?: string; badgeCount?: number; conversationId?: number };
  } = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "Bioalergia", body: event.data.text() };
    }
  }
  const title = payload.title ?? "Bioalergia";
  const isData = payload.kind === "data";
  // Run notification + badge update in parallel; event.waitUntil
  // keeps the SW alive until both promises settle so the OS doesn't
  // consider the push event "completed without showing notification".
  //
  // For `kind: "data"` pushes (state syncs from another device — e.g.
  // "another tab marked the conversation read, just update the
  // badge"), the spec still requires us to call showNotification or
  // the UA may unsubscribe us. We render a silent placeholder and
  // close it within the same waitUntil so nothing reaches the user.
  event.waitUntil(
    Promise.all([
      (async () => {
        await self.registration.showNotification(title, {
          body: isData ? "" : (payload.body ?? ""),
          icon: payload.icon ?? "/icons/icon-192.png",
          badge: "/icons/icon-72.png",
          tag: isData ? `__data_${payload.tag ?? Date.now()}` : payload.tag,
          data: payload.data ?? {},
          silent: payload.silent ?? isData,
          requireInteraction: !isData && (payload.requireInteraction ?? false),
          // i18n hints: tells the OS / screen-readers which language
          // to use for TTS + bidi resolution. Bioalergia is single-
          // tenant Chilean; backend already sends Spanish strings so
          // hardcoding es-CL is safe.
          lang: "es-CL",
          dir: "ltr",
          // Trim to UA-supported maximum so Android/iOS render
          // consistently. Chromium exposes maxActions; Safari
          // ignores extras silently but defining a hard cap of 2
          // keeps the layout predictable across platforms.
          actions: isData ? [] : (payload.actions ?? []).slice(0, 2),
          // `image`, `timestamp`, `renotify`, `vibrate` are in the spec
          // but not all in lib.dom. Cast keeps TS happy while the OS
          // (Chromium / iOS 16.4+) honours each one when available.
          ...({
            image: isData ? undefined : payload.image,
            timestamp: payload.timestamp ?? Date.now(),
            renotify: !isData && !!payload.tag,
            // Two short pulses → standard messaging app feel on Android.
            vibrate: isData ? [] : [200, 100, 200],
          } as Record<string, unknown>),
        });
        // Cross-tab sync: every open intranet tab gets a chance to
        // refetch the inbox before the operator clicks. Falls back
        // silently in browsers without BroadcastChannel.
        try {
          const ch = new BroadcastChannel("inbox-state");
          ch.postMessage({
            type: "push-received",
            kind: payload.kind ?? "notification",
            badgeCount: payload.badgeCount,
            conversationId: payload.data?.conversationId,
            ts: Date.now(),
          });
          ch.close();
        } catch {
          // ignore
        }
        if (isData) {
          // Close immediately — the spec requirement is satisfied,
          // the operator never sees a banner.
          const tag = `__data_${payload.tag ?? Date.now()}`;
          const stale = await self.registration.getNotifications({ tag });
          stale.forEach((n) => n.close());
        }
      })(),
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
  const data =
    (event.notification.data as {
      url?: string;
      conversationId?: number;
    }) ?? {};
  const target = data.url ?? "/";
  // Close every other notification with the same tag so opening a
  // conversation clears its stack from the OS notification center.
  // Without this the operator still sees three "Juan Pérez" banners
  // after tapping one and replying.
  const tag = event.notification.tag;
  // Action button "Marcar leído": call the backend without ever
  // surfacing a tab. credentials:"include" carries the PASETO
  // session cookie. Best-effort — if the request fails the operator
  // still sees the banner and can tap to open normally.
  if (event.action === "mark-read" && data.conversationId) {
    event.waitUntil(
      (async () => {
        try {
          await fetch("/api/orpc/wa-cloud/conversations/mark-read", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ conversationId: data.conversationId }),
          });
          try {
            const ch = new BroadcastChannel("inbox-state");
            ch.postMessage({
              type: "marked-read",
              conversationId: data.conversationId,
              ts: Date.now(),
            });
            ch.close();
          } catch {
            // ignore
          }
        } catch {
          // ignore — best-effort
        }
        if (tag) {
          const same = await self.registration.getNotifications({ tag });
          for (const n of same) n.close();
        }
      })()
    );
    return;
  }
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

// ─── Subscription rotation ────────────────────────────────────────────────────
// Apple/FCM rotate push channel endpoints periodically. Without this
// handler the old endpoint silently dies and the operator stops
// receiving messages until they re-toggle in the UI. The SW spec
// fires `pushsubscriptionchange` with `oldSubscription` (always)
// and `newSubscription` (sometimes — UAs that auto-resubscribe). If
// the UA didn't pre-resubscribe, we do it here using the VAPID key
// the original sub was registered with.
//
// We POST to the unauthenticated /rotate endpoint because background
// SW fetches don't always carry session cookies (Safari iOS strips
// them on subscription renewal). The oldEndpoint is the secret —
// only a client that held the previous subscription knows it.
self.addEventListener("pushsubscriptionchange", (event) => {
  const e = event as PushSubscriptionChangeEvent;
  event.waitUntil(
    (async () => {
      try {
        const old = e.oldSubscription;
        let next = e.newSubscription;
        if (!next && old) {
          // applicationServerKey may come back as ArrayBuffer; the
          // PushManager.subscribe API accepts ArrayBuffer or BufferSource.
          const opts = old.options;
          next = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: opts.applicationServerKey ?? undefined,
          });
        }
        if (!next || !old) return;
        const j = next.toJSON() as {
          endpoint: string;
          keys?: { auth?: string; p256dh?: string };
        };
        if (!j.endpoint || !j.keys?.auth || !j.keys?.p256dh) return;
        await fetch("/api/orpc/notifications/rotate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            oldEndpoint: old.endpoint,
            subscription: {
              endpoint: j.endpoint,
              keys: { auth: j.keys.auth, p256dh: j.keys.p256dh },
            },
          }),
        });
      } catch {
        // Swallow — the next push attempt against the dead endpoint
        // will 410 and the backend GCs it via the existing cleanup.
      }
    })()
  );
});

// ─── Web Share Target API ─────────────────────────────────────────────────────
// Manifest registers /share-target as POST; intercepting here lets us
// pass the shared payload to the WhatsApp inbox without bouncing
// through a server route. Stash the payload in a one-shot Cache
// entry so the SPA can pick it up after the redirect.
const SHARE_CACHE = "share-target-inbox-v1";
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname !== "/share-target" || event.request.method !== "POST") return;
  event.respondWith(
    (async () => {
      try {
        const formData = await event.request.formData();
        const title = String(formData.get("title") ?? "");
        const text = String(formData.get("text") ?? "");
        const sharedUrl = String(formData.get("url") ?? "");
        const files = formData.getAll("files").filter((f): f is File => f instanceof File);
        const cache = await caches.open(SHARE_CACHE);
        // Files survive the redirect via Cache; the SPA reads them
        // back via /share-target/payload below.
        await cache.put(
          "/__share_payload",
          new Response(
            JSON.stringify({
              title,
              text,
              url: sharedUrl,
              fileCount: files.length,
              ts: Date.now(),
            }),
            { headers: { "content-type": "application/json" } }
          )
        );
        for (const [i, file] of files.entries()) {
          await cache.put(
            `/__share_file_${i}`,
            new Response(file, {
              headers: {
                "content-type": file.type || "application/octet-stream",
                "x-filename": encodeURIComponent(file.name),
              },
            })
          );
        }
      } catch {
        // best-effort
      }
      return Response.redirect("/wa-cloud?shared=1", 303);
    })()
  );
});
