/**
 * Global toast interceptor that automatically persists all toasts to notification history.
 * Use this instead of importing toast directly from 'sonner'.
 */

import { toast as sonnerToast } from "sonner";
import { addNotification } from "@/features/notifications/store/use-notification-store";

type ToastOptions = Parameters<typeof sonnerToast.success>[1];
type PromiseOptions = Parameters<typeof sonnerToast.promise>[1];
type ToastPromise = Parameters<typeof sonnerToast.promise>[0];

function asMessage(value: unknown, fallback: string, input?: unknown): string {
  let resolved = value;
  if (typeof resolved === "function") {
    try {
      resolved = (resolved as (payload?: unknown) => unknown)(input);
    } catch {
      return fallback;
    }
  }

  if (typeof resolved === "string") {
    return resolved;
  }
  if (resolved && typeof resolved === "object" && "message" in resolved) {
    const message = (resolved as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
}

function getTitle(description: unknown, fallback: string): string {
  return description ? String(description) : fallback;
}

/**
 * Wrapper around Sonner's toast that automatically saves to notification history.
 * Maps Sonner toast types to notification types.
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "success",
      message,
      title: getTitle(options?.description, "Éxito"),
    });
    return sonnerToast.success(message, options);
  },

  error: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "error",
      message,
      title: getTitle(options?.description, "Error"),
    });
    return sonnerToast.error(message, options);
  },

  info: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: getTitle(options?.description, "Información"),
    });
    return sonnerToast.info(message, options);
  },

  warning: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "warning",
      message,
      title: getTitle(options?.description, "Advertencia"),
    });
    return sonnerToast.warning(message, options);
  },

  loading: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: getTitle(options?.description, "En progreso"),
    });
    return sonnerToast.loading(message, options);
  },

  promise: (promise: ToastPromise, options?: PromiseOptions) => {
    const operation =
      typeof promise === "function" ? (promise as () => Promise<unknown>)() : promise;

    if (options?.loading) {
      addNotification({
        type: "info",
        message: asMessage(options.loading, "Procesando..."),
        title: "En progreso",
      });
    }

    void operation
      .then((result) => {
        addNotification({
          type: "success",
          message: asMessage(options?.success, "Operación completada", result),
          title: "Éxito",
        });
      })
      .catch((error: unknown) => {
        addNotification({
          type: "error",
          message: asMessage(
            options?.error,
            error instanceof Error ? error.message : "Error en la operación",
            error,
          ),
          title: "Error",
        });
      });

    return sonnerToast.promise(operation, options);
  },

  message: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: getTitle(options?.description, "Información"),
    });
    return sonnerToast.message(message, options);
  },

  dismiss: sonnerToast.dismiss,
};
