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
    onNeedRefresh() {
      console.info("New app version available - prompting user");
      setNeedRefresh(true);
    },
    onRegistered() {
      // No periodic checks - let browser handle update detection naturally
      // The service worker will auto-detect new versions on navigation/reload
      // This prevents the notification from appearing repeatedly after update
      console.info("Service worker registered - auto-update detection enabled");
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);
    setNeedRefresh(false);

    try {
      // Step 1: Tell the new service worker to skip waiting and activate
      await updateServiceWorker(true);

      // Step 2: Wait for the new service worker to actually take control
      // This is crucial - we need to ensure the new SW is controlling before clearing cache
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              resolve();
            },
            { once: true }
          );
          // Fallback timeout in case controllerchange doesn't fire
          setTimeout(resolve, 1000);
        });
      }

      // Step 3: Now clear all caches (the new SW is in control)
      if ("caches" in globalThis) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }

      // Step 4: Force a complete reload from network
      globalThis.location.reload();
    } catch (error) {
      console.error("Update failed", error);
      globalThis.location.reload();
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
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base-content text-sm font-semibold">Nueva versión disponible</h3>
            <p className="text-base-content/70 mt-1 text-xs">Actualiza cuando estés listo. No perderás tu progreso.</p>
            <div className="mt-3 flex gap-2">
              <Button className="flex-1" disabled={isUpdating} onClick={handleUpdate} size="sm">
                {isUpdating ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button
                className="px-3"
                onClick={() => {
                  setNeedRefresh(false);
                }}
                size="sm"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
