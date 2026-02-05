import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { type AppFallbackReason, clearAppCaches, onAppFallback } from "@/lib/app-recovery";

const PRE_MOUNT_SHELL_ID = "app-fallback";

function normalizeReason(reason?: string | null): AppFallbackReason | null {
  if (!reason) {
    return null;
  }
  if (reason === "chunk" || reason === "offline" || reason === "update" || reason === "unknown") {
    return reason;
  }
  return "unknown";
}

function readInitialReason(): AppFallbackReason | null {
  if (typeof window === "undefined") {
    return null;
  }
  return normalizeReason(window.__APP_FALLBACK_REASON__);
}

function hidePreMountShell() {
  if (typeof document === "undefined") {
    return;
  }
  const shell = document.getElementById(PRE_MOUNT_SHELL_ID);
  if (shell) {
    shell.setAttribute("hidden", "");
  }
}

export function AppFallback() {
  const [reason, setReason] = useState<AppFallbackReason | null>(readInitialReason());
  const [isOpen, setIsOpen] = useState(Boolean(readInitialReason()));
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    hidePreMountShell();
  }, []);

  useEffect(() => {
    const unsubscribe = onAppFallback((nextReason) => {
      setReason(nextReason);
      setIsOpen(true);
    });

    const handleOffline = () => {
      setReason("offline");
      setIsOpen(true);
    };

    const handleOnline = () => {
      if (reason === "offline") {
        setIsOpen(false);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [reason]);

  const content = useMemo(() => {
    switch (reason) {
      case "offline":
        return {
          title: "Sin conexión",
          body: "Estás offline. Cuando vuelvas a tener conexión, intenta recargar la app.",
          primary: "Reintentar",
        };
      case "chunk":
        return {
          title: "Actualización pendiente",
          body: "Detectamos una versión nueva o un recurso en caché. Recarga para seguir.",
          primary: "Recargar",
        };
      case "update":
        return {
          title: "Actualización disponible",
          body: "Hay una versión nueva lista. Puedes actualizar cuando estés listo.",
          primary: "Actualizar",
        };
      default:
        return {
          title: "Algo salió mal",
          body: "No pudimos cargar la aplicación. Intenta nuevamente.",
          primary: "Reintentar",
        };
    }
  }, [reason]);

  const handleReload = () => {
    globalThis.location.reload();
  };

  const handleCleanReload = async () => {
    if (isWorking) {
      return;
    }
    setIsWorking(true);
    try {
      await clearAppCaches();
    } finally {
      globalThis.location.reload();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title={content.title}>
        <div className="text-default-600 text-sm">{content.body}</div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={handleReload} size="sm" variant="primary">
            {content.primary}
          </Button>
          <Button onClick={() => setIsConfirmOpen(true)} size="sm" variant="secondary">
            Limpiar caché
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Limpiar caché y recargar"
      >
        <div className="text-default-600 text-sm">
          Esto forzará una recarga completa y eliminará datos en caché. Úsalo solo si el problema
          persiste.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={handleCleanReload} size="sm" variant="primary" disabled={isWorking}>
            {isWorking ? "Limpiando..." : "Limpiar y recargar"}
          </Button>
          <Button onClick={() => setIsConfirmOpen(false)} size="sm" variant="ghost">
            Cancelar
          </Button>
        </div>
      </Modal>
    </>
  );
}
