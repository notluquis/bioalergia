import { useRegisterSW } from "virtual:pwa-register/react";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";

export function UpdateNotification() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [hasReloaded, setHasReloaded] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates when page becomes visible
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) r.update();
        });
        // Check for updates periodically (every 5 minutes) without forcing reload
        setInterval(() => r.update(), 5 * 60 * 1000);

        // If a new worker is found, surface the banner (non-blocking, no auto-reload)
        r.addEventListener?.("updatefound", () => {
          setNeedRefresh(true);
        });
      }
    },
    onNeedRefresh() {
      console.info("New app version available");
      setNeedRefresh(true);
    },
  });

  const handleUpdate = () => {
    setIsUpdating(true);
    updateServiceWorker(true).catch(() => {
      // Si falla el flujo normal, recargar manualmente
      window.location.reload();
    });
  };

  useEffect(() => {
    // Recarga segura cuando el nuevo SW toma el control (sin forzar si el usuario no pulsó)
    const onControllerChange = () => {
      if (hasReloaded) return;
      setHasReloaded(true);
      window.location.reload();
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange);
    };
  }, [hasReloaded]);

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
