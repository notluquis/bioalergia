// Service Worker Registration with Build-based Cache Strategy
// Only checks for updates on page load (not every 60s)

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.log("[SW] Service Workers not supported");
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none", // Always fetch fresh sw.js
      });

      console.log("[SW] Registered successfully:", registration.scope);

      // Handle updates when detected
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("[SW] New service worker found, installing...");

        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[SW] New version available, reloading in 2s...");

            // Auto-reload para activar nuevo BUILD_ID
            setTimeout(() => {
              newWorker.postMessage({ type: "SKIP_WAITING" });
              window.location.reload();
            }, 2000);
          }
        });
      });

      // Reload cuando el SW toma control (nuevo BUILD_ID activado)
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          console.log("[SW] New BUILD_ID active, reloading page");
          window.location.reload();
        }
      });
    } catch (error) {
      console.error("[SW] Registration failed:", error);
    }
  });
}

// Force cache clear utility (manual, para emergencias)
export async function clearAllCaches() {
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    console.log("[SW] All caches cleared manually");
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
  }
}
