// Service Worker Registration with AGGRESSIVE Update Detection
// Ensures Railway builds are ALWAYS detected and applied

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.log("[SW] Service Workers not supported");
    return;
  }

  let refreshing = false;

  // Force check for updates (bypasses browser cache completely)
  async function forceUpdateCheck() {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return;

      console.log("[SW] Forcing update check...");

      // Update with cache bypass
      await registration.update();

      console.log("[SW] Update check complete");
    } catch (error) {
      console.error("[SW] Update check failed:", error);
    }
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none", // NEVER cache sw.js
      });

      console.log("[SW] Registered successfully:", registration.scope);

      // Immediately check for updates on load
      await registration.update();

      // Handle updates when detected
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        console.log("[SW] 🔄 New build detected! Installing...");

        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[SW] ✅ New build ready! Will activate...");

            // Tell new SW to activate immediately
            newWorker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });

      // Listen for messages from SW (like FORCE_RELOAD)
      navigator.serviceWorker.addEventListener("message", async (event) => {
        if (event.data?.type === "FORCE_RELOAD") {
          console.log("[SW] 🔄 Force reload requested:", event.data.reason);
          if (!refreshing) {
            refreshing = true;
            await clearAllCaches();
            window.location.reload();
          }
        }
      });

      // Reload when the SW takes control (new BUILD_ID activated)
      navigator.serviceWorker.addEventListener("controllerchange", async () => {
        if (!refreshing) {
          refreshing = true;
          console.log("[SW] 🚀 New build activated! Clearing cache and reloading...");

          // Clear ALL caches aggressively
          await clearAllCaches();

          // Hard reload to bypass any lingering cache
          window.location.reload();
        }
      });

      // Check for updates on page visibility change (when user comes back to tab)
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          console.log("[SW] 👁️ Page visible, checking for updates...");
          forceUpdateCheck();
        }
      });

      // Check for updates when page gains focus
      window.addEventListener("focus", () => {
        console.log("[SW] 🎯 Window focused, checking for updates...");
        forceUpdateCheck();
      });

      // Periodic update check every 6 hours (reasonable interval)
      setInterval(
        () => {
          console.log("[SW] ⏰ Periodic update check (6h)...");
          forceUpdateCheck();
        },
        6 * 60 * 60 * 1000
      ); // 6 hours
    } catch (error) {
      console.error("[SW] Registration failed:", error);
    }
  });
}

// Clear ALL caches aggressively (except preserving auth token)
export async function clearAllCaches() {
  if ("caches" in window) {
    const names = await caches.keys();
    console.log(`[SW] Deleting ${names.length} cache(s):`, names);
    await Promise.all(names.map((name) => caches.delete(name)));
    console.log("[SW] ✅ All caches cleared");
  }

  // Clear localStorage but preserve auth
  try {
    const authToken = localStorage.getItem("token");
    localStorage.clear();
    if (authToken) {
      localStorage.setItem("token", authToken);
      console.log("[SW] ✅ localStorage cleared (auth preserved)");
    }
  } catch (e) {
    console.warn("[SW] Could not clear localStorage:", e);
  }

  // Clear sessionStorage
  try {
    sessionStorage.clear();
    console.log("[SW] ✅ sessionStorage cleared");
  } catch (e) {
    console.warn("[SW] Could not clear sessionStorage:", e);
  }
}

// Manual update check (for button)
export async function checkForUpdates(): Promise<boolean> {
  console.log("[SW] 🔍 Manual update check requested");
  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      try {
        await registration.update();
        // Check if there's a new worker installing or waiting
        if (registration.installing || registration.waiting) {
          console.log("[SW] ✅ Update found!");
          return true;
        }
      } catch (e) {
        console.error("[SW] Update check failed:", e);
      }
    }
  }
  console.log("[SW] No update found");
  return false;
}
