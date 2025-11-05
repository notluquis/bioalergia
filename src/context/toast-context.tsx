import React, { createContext, useCallback, useContext, useState } from "react";
import { X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ToastContextType = {
  toasts: Toast[];
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 3;
const DEFAULT_DURATION = 5000; // 5 seconds

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = DEFAULT_DURATION) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const toast: Toast = { id, type, message, duration };

    setToasts((prev) => {
      const newToasts = [...prev, toast];
      // Keep only MAX_TOASTS most recent
      return newToasts.slice(-MAX_TOASTS);
    });

    // Auto-dismiss if duration is specified
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, duration?: number) => addToast("success", message, duration),
    [addToast]
  );

  const error = useCallback((message: string, duration?: number) => addToast("error", message, duration), [addToast]);

  const warning = useCallback(
    (message: string, duration?: number) => addToast("warning", message, duration),
    [addToast]
  );

  const info = useCallback((message: string, duration?: number) => addToast("info", message, duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

// Toast Container Component
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-auto" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// Individual Toast Component
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const typeClasses: Record<ToastType, string> = {
    success: "alert-success",
    error: "alert-error",
    warning: "alert-warning",
    info: "alert-info",
  };

  return (
    <div
      className={`alert ${typeClasses[toast.type]} shadow-lg flex items-center justify-between gap-4 animate-slide-in-right`}
      role="alert"
    >
      <span className="text-sm font-medium leading-5">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="btn btn-ghost btn-xs btn-circle"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}
