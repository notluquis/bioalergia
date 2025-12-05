import { useRegisterSW } from "virtual:pwa-register/react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";

export function UpdateNotification() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Check for updates on visibility change and periodically
      if (r) {
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) r.update();
        });
        setInterval(() => r.update(), 6 * 60 * 60 * 1000); // Every 6 hours
      }
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5 fade-in">
      <div className="rounded-2xl border border-primary/20 bg-base-100 p-4 shadow-2xl">
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
            <p className="mt-1 text-xs text-base-content/70">Actualiza para obtener las últimas mejoras.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => updateServiceWorker(true)} className="flex-1">
                Actualizar
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
