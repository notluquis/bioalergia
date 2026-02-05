export type AppFallbackReason = "chunk" | "offline" | "update" | "unknown";

const FALLBACK_EVENT = "app:fallback";

export function signalAppFallback(reason: AppFallbackReason) {
  if (typeof window === "undefined") {
    return;
  }

  window.__APP_FALLBACK_REASON__ = reason;
  window.dispatchEvent(new CustomEvent(FALLBACK_EVENT, { detail: { reason } }));
}

export function onAppFallback(callback: (reason: AppFallbackReason) => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as { reason?: AppFallbackReason };
    if (detail?.reason) {
      callback(detail.reason);
    }
  };

  window.addEventListener(FALLBACK_EVENT, handler);
  return () => window.removeEventListener(FALLBACK_EVENT, handler);
}

/**
 * Clear only the runtime caches, but keep service workers registered.
 * Use this for emergency situations (hard reset) when you want to force fresh content.
 *
 * NOTE: With StaleWhileRevalidate strategy (cachePreset), manual cache clearing
 * is usually UNNECESSARY. Workbox automatically invalidates caches on SW update.
 * Only use this for troubleshooting, not in normal update flows.
 */
export async function clearOnlyCaches() {
  if (typeof window === "undefined" || !("caches" in globalThis)) {
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
}

/**
 * Clear all caches AND unregister all service workers.
 * Use this only for hard resets or error recovery.
 */
export async function clearAppCaches() {
  if (typeof window === "undefined") {
    return;
  }

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((r) => r.unregister()));
  }

  if ("caches" in globalThis) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
}

declare global {
  interface Window {
    __APP_FALLBACK_REASON__?: AppFallbackReason;
  }
}
