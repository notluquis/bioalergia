import { useEffect, useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";

export function UpdateNotification() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [newWorker, setNewWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handleUpdate = () => {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setNewWorker(registration.waiting);
          setShowUpdate(true);
        }

        // Watch for new service worker installing
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
              // New version available
              setNewWorker(installingWorker);
              setShowUpdate(true);
            }
          });
        });
      });

      // Listen for controller change (when SW is activated)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // SW has been updated, reload the page
        window.location.reload();
      });
    };

    handleUpdate();

    // Check for updates every 5 minutes
    const interval = setInterval(
      () => {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update();
        });
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (!newWorker) return;

    // Clear all caches
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }

    // Clear localStorage except auth token
    const authToken = localStorage.getItem("token");
    localStorage.clear();
    if (authToken) {
      localStorage.setItem("token", authToken);
    }

    // Clear sessionStorage
    sessionStorage.clear();

    // Tell SW to skip waiting and activate
    newWorker.postMessage({ type: "SKIP_WAITING" });

    // The controllerchange event will trigger reload
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in">
      <div className="rounded-2xl border border-primary/20 bg-base-100 p-4 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-base-content">Nueva versión disponible</h3>
            <p className="mt-1 text-xs text-base-content/70">
              Hay una actualización disponible. Se recargará la página y se limpiará el caché.
            </p>

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={handleUpdate} className="flex-1">
                Actualizar ahora
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowUpdate(false)} className="px-3">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
