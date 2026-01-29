import type { ReactNode } from "react";
import { Toaster, toast } from "sonner";

export interface ToastOptions {
  duration?: number;
  message: string;
  title?: string;
  variant?: ToastVariant;
}

export type ToastVariant = "error" | "info" | "success";

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster richColors position="bottom-right" />
    </>
  );
}

import { addNotification } from "@/features/notifications/store/use-notification-store";

export function useToast() {
  const showToast = ({ duration, message, title, variant = "info" }: ToastOptions) => {
    // Add to persistent history
    addNotification({
      type: variant === "success" ? "success" : variant === "error" ? "error" : "info",
      message,
      title,
    });

    const opts = { duration, description: title };
    switch (variant) {
      case "success":
        toast.success(message, opts);
        break;
      case "error":
        toast.error(message, opts);
        break;
      default:
        toast.info(message, opts);
        break;
    }
  };

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
    success,
    error,
    info,
    showToast,
  };
}
