import { useRegisterSW } from "virtual:pwa-register/react";
import { X } from "lucide-react";
import { useState } from "react";
import Button from "@/components/ui/Button";

export function UpdateNotification() {
  const [isUpdating, setIsUpdating] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates periodically (every 1 hour) without forcing reload
        setInterval(() => r.update(), 60 * 60 * 1000);
      }
    },
    onNeedRefresh() {
      console.info("New app version available");
      setNeedRefresh(true);
    },
  });

  const handleUpdate = async () => {
    setIsUpdating(true);

    // Fallback de seguridad: recargar después de 4 segundos si el evento controllerchange no se dispara
    const fallbackId = setTimeout(() => {
      window.location.reload();
    }, 4000);

    // Registrar el listener para recargar solo cuando el worker cambie realmente
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => {
          clearTimeout(fallbackId);
          window.location.reload();
        },
        { once: true }
      );
    }

    try {
      await updateServiceWorker(true);
    } catch (error) {
      console.error("Update failed", error);
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
