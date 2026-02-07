import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { toast } from "@/lib/toast-interceptor";

export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {children}
      <Toaster
        closeButton
        position="bottom-right"
        richColors
        style={{
          zIndex: 9999,
        }}
        toastOptions={{
          style: {
            zIndex: 9999,
          },
        }}
      />
    </>
  );
}

/**
 * Legacy useToast hook - now uses the global toast interceptor internally.
 * Maps legacy function-based API to the modern options-based API.
 * Kept for backward compatibility with existing code.
 */
export function useToast() {
  return {
    success: (message: string, title = "Éxito") => {
      toast.success(message, { description: title });
    },
    error: (message: unknown, title = "Error") => {
      const msg =
        typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : String(message);
      toast.error(msg, { description: title });
    },
    info: (message: string, title = "Información") => {
      toast.info(message, { description: title });
    },
  };
}
