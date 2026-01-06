import { X } from "lucide-react";
import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import Button from "@/components/ui/Button";

export function UpdateNotification() {
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates periodically every 4 hours (reduced from 1h to minimize interruptions)
        // Only checks when tab is visible to avoid unnecessary background checks
        // Railway auto-deploys trigger new SW versions, but we don't want to annoy users
        const intervalMs = 4 * 60 * 60 * 1000; // 4 hours
        
        setInterval(() => {
          // Only check if the document is visible (user is actively using the app)
          if (document.visibilityState === "visible") {
            r.update();
          }
        }, intervalMs);
        
        // ALTERNATIVE: Disable periodic checks completely and rely on natural browser updates
        // The service worker will still update on next navigation/reload
        // Uncomment below and remove setInterval above if updates are still too frequent:
        // (No periodic checks - SW updates naturally on navigation)
      }
    },
    onNeedRefresh() {
      console.info("New app version available");
      setNeedRefresh(true);
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);

    try {
      // Skip waiting on new service worker and activate immediately
      await updateServiceWorker(true);

      // Clear all caches for a completely fresh start
      if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Hard refresh - bypasses browser cache completely
      window.location.href = window.location.href.split("?")[0] + "?v=" + Date.now();
    } catch (error) {
      console.error("Update failed", error);
      // Fallback: force reload anyway
      window.location.reload();
    }
  };

  // Removed automatic reload on controllerchange to prevent data loss.
  // The updateServiceWorker call below will handle the reload when the user clicks "Update".

  if (!needRefresh) return null;

  return (
    <div className="animate-in slide-in-from-bottom-5 fade-in fixed right-4 bottom-4 z-50 max-w-sm">
      <div className="border-primary/20 bg-base-100 rounded-2xl border p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <svg className="text-primary h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base-content text-sm font-semibold">Nueva versión disponible</h3>
            <p className="text-base-content/70 mt-1 text-xs">Actualiza cuando estés listo. No perderás tu progreso.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleUpdate} className="flex-1" disabled={isUpdating}>
                {isUpdating ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)} className="px-3">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
