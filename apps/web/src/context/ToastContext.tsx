import { createContext, type ReactNode, useContext, useState } from "react";

export interface ToastOptions {
  duration?: number;
  message: string;
  title?: string;
  variant?: ToastVariant;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

interface ToastRecord {
  expiresAt: number;
  id: number;
  message: string;
  title?: string;
  variant: ToastVariant;
}

type ToastVariant = "error" | "info" | "success";

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const removeToast = (id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  };

  const showToast = ({ duration = 4000, message, title, variant = "info" }: ToastOptions) => {
    const id = Date.now();
    const expiresAt = Date.now() + duration;

    setToasts((current) => [...current, { expiresAt, id, message, title, variant }]);

    globalThis.setTimeout(() => {
      removeToast(id);
    }, duration);
  };

  const value: ToastContextValue = { showToast };

  return (
    <ToastContext value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-9999 flex flex-col items-center gap-3 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <div
            className={`surface-elevated pointer-events-auto w-full max-w-sm border-l-4 px-4 py-3 text-sm shadow-xl select-text sm:w-80 ${(() => {
              if (toast.variant === "success") return "border-success/70 text-success";
              if (toast.variant === "error") return "border-error/70 text-error";
              return "border-primary/50 text-base-content";
            })()}`}
            key={toast.id}
          >
            {toast.title && <p className="text-base-content font-semibold">{toast.title}</p>}
            <p className="text-base-content/80 cursor-text text-sm">{toast.message}</p>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de un ToastProvider.");
  }

  const { showToast } = context;

  const success = (message: string, title = "Éxito") => {
    showToast({ message, title, variant: "success" });
  };

  const error = (message: string, title = "Error") => {
    showToast({ message, title, variant: "error" });
  };

  const info = (message: string, title = "Información") => {
    showToast({ message, title, variant: "info" });
  };

  return {
    error,
    info,
    showToast,
    success,
  };
}
