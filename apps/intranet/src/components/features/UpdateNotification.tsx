import { useRegisterSW } from "virtual:pwa-register/react";
import { Modal } from "@heroui/react";
import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { clearOnlyCaches } from "@/lib/app-recovery";

export function UpdateNotification() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedRefresh() {
      setNeedRefresh(true);
    },
    onRegistered() {
      // No periodic checks - let browser handle update detection naturally
      // The service worker will auto-detect new versions on navigation/reload
      // This prevents the notification from appearing repeatedly after update
    },
  });
  const handleUpdate = async () => {
    setIsUpdating(true);
    // DON'T reset needRefresh here - let the reload handle it naturally
    // If we reset it and the update fails, the notification disappears but nothing happens

    try {
      // CRITICAL ORDER FOR WINDOWS 11 COMPATIBILITY:
      // Step 1: Clear cache FIRST (before SW activates)
      // This ensures old assets don't persist when new SW takes control
      await clearOnlyCaches();

      // Step 2: Tell the new service worker to skip waiting and activate
      await updateServiceWorker(true);

      // Step 3: Wait for the new service worker to actually take control
      // This is crucial - we need to ensure the new SW is controlling before reloading
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              resolve();
            },
            { once: true },
          );
          // Generous timeout for slow connections (was 3000ms)
          setTimeout(resolve, 5000);
        });
      }

      // Step 4: Simple reload - cache is already cleared, no need for query params
      // Query params only affect HTML navigation, not JS/CSS subresources
      globalThis.location.reload();
    } catch (error) {
      console.error("Update failed", error);
      // Fallback to reload even on error
      globalThis.location.reload();
    }
  };

  const handleCleanUpdate = async () => {
    if (isUpdating) {
      return;
    }
    setIsUpdating(true);
    // DON'T reset needRefresh here - let the reload handle it naturally

    try {
      // CRITICAL ORDER FOR CACHE CLEANUP:
      // Step 1: Clear cache FIRST (before activating new SW)
      // This is the whole point of "clean update" - fresh slate
      await clearOnlyCaches();

      // Step 2: Activate new service worker
      await updateServiceWorker(true);

      // Step 3: Wait for new SW to take control
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              resolve();
            },
            { once: true },
          );
          setTimeout(resolve, 5000);
        });
      }

      // Step 4: Reload - cache already cleared, assets will be fresh
      globalThis.location.reload();
    } catch (error) {
      console.error("Clean update failed", error);
      globalThis.location.reload();
    }
  };

  // Removed automatic reload on controllerchange to prevent data loss.
  // The updateServiceWorker call below will handle the reload when the user clicks "Update".

  if (!needRefresh) {
    return null;
  }

  return (
    <>
      <div className="slide-in-from-bottom-5 fade-in fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+6rem)] z-50 max-w-sm animate-in md:bottom-4">
        <div className="rounded-2xl border border-primary/20 bg-background p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <svg
                className="h-6 w-6 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Update Available</title>
                <path
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground text-sm">Nueva versión disponible</h3>
              <p className="mt-1 text-default-600 text-xs">
                Actualiza cuando estés listo. No perderás tu progreso.
              </p>
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" disabled={isUpdating} onClick={handleUpdate} size="sm">
                  {isUpdating ? "Actualizando..." : "Actualizar"}
                </Button>
                <Button onClick={() => setIsConfirmOpen(true)} size="sm" variant="secondary">
                  Limpiar caché
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

      <Modal>
        <Modal.Backdrop
          className="bg-black/40 backdrop-blur-[2px]"
          isOpen={isConfirmOpen}
          onOpenChange={(open) => {
            if (!open) {
              setIsConfirmOpen(false);
            }
          }}
        >
          <Modal.Container placement="center">
            <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
              <Modal.Header className="mb-4 font-bold text-primary text-xl">
                <Modal.Heading>Limpiar caché y actualizar</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="mt-2 max-h-[80vh] overflow-y-auto overscroll-contain text-foreground">
                <p className="text-default-600 text-sm">
                  Esto elimina la caché local y fuerza una recarga completa. Úsalo solo si ves
                  errores al actualizar.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    onClick={handleCleanUpdate}
                    size="sm"
                    variant="primary"
                    disabled={isUpdating}
                  >
                    {isUpdating ? "Actualizando..." : "Limpiar y actualizar"}
                  </Button>
                  <Button onClick={() => setIsConfirmOpen(false)} size="sm" variant="ghost">
                    Cancelar
                  </Button>
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
