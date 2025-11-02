import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastVariant = "success" | "error" | "info";

export type ToastOptions = {
  message: string;
  title?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastRecord = {
  id: number;
  message: string;
  title?: string;
  variant: ToastVariant;
  expiresAt: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const showToast = useCallback(({ message, title, variant = "info", duration = 4000 }: ToastOptions) => {
    const id = Date.now();
    const expiresAt = Date.now() + duration;
    setToasts((current) => [...current, { id, message, title, variant, expiresAt }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, duration);
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[9999] flex flex-col items-center gap-3 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm rounded-2xl border border-white/60 px-4 py-3 shadow-lg sm:w-80 ${
              toast.variant === "success"
                ? "bg-emerald-500/90 text-white"
                : toast.variant === "error"
                  ? "bg-rose-500/90 text-white"
                  : "bg-slate-800/90 text-white"
            }`}
          >
            {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
            <p className="text-sm">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de un ToastProvider.");
  }

  const { showToast } = context;

  return {
    showToast,
    success: (message: string, title = "Éxito") => showToast({ message, title, variant: "success" }),
    error: (message: string, title = "Error") => showToast({ message, title, variant: "error" }),
    info: (message: string, title = "Información") => showToast({ message, title, variant: "info" }),
  };
}
