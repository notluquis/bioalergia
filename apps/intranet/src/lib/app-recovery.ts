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
 * Clear only the caches, but keep service workers registered.
 * Use this for updates when you want to force fresh content but maintain SW control.
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

/**
 * Force a hard reload with cache bypass.
 * Adds a timestamp query parameter to ensure browser doesn't serve cached version.
 */
export function forceReload() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(globalThis.location.href);
  url.searchParams.set("_pwa_update", Date.now().toString());
  globalThis.location.replace(url.toString());
}

declare global {
  interface Window {
    __APP_FALLBACK_REASON__?: AppFallbackReason;
  }
}
