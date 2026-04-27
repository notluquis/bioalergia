/**
 * Global toast interceptor that automatically persists all toasts to notification history.
 * Use this instead of importing toast directly from '@heroui/react'.
 */

import { toast as heroToast } from "@heroui/react";
import { addNotification } from "@/features/notifications/store/use-notification-store";

type ToastOptions = Parameters<typeof heroToast.success>[1];
type PromiseOptions = NonNullable<Parameters<typeof heroToast.promise>[1]>;
type ToastPromise = Parameters<typeof heroToast.promise>[0];

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
  if (typeof description === "string" && description.trim().length > 0) {
    return description;
  }
  if (typeof description === "number" || typeof description === "boolean") {
    return String(description);
  }
  if (description && typeof description === "object" && "message" in description) {
    const message = (description as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }
  return fallback;
}

/**
 * Wrapper around HeroUI toast that automatically saves to notification history.
 * Maps toast variants to notification types.
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "success",
      message,
      title: getTitle(options?.description, "Éxito"),
    });
    return heroToast.success(message, options);
  },

  error: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "error",
      message,
      title: getTitle(options?.description, "Error"),
    });
    return heroToast.danger(message, options);
  },

  info: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: getTitle(options?.description, "Información"),
    });
    return heroToast.info(message, options);
  },

  warning: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "warning",
      message,
      title: getTitle(options?.description, "Advertencia"),
    });
    return heroToast.warning(message, options);
  },

  loading: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: getTitle(options?.description, "En progreso"),
    });
    return heroToast(message, { ...options, isLoading: true, timeout: 0 });
  },

  promise: (promise: ToastPromise, options: PromiseOptions) => {
    const operation =
      typeof promise === "function" ? (promise as () => Promise<unknown>)() : promise;

    if (options.loading) {
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
          message: asMessage(options.success, "Operación completada", result),
          title: "Éxito",
        });
      })
      .catch((error: unknown) => {
        addNotification({
          type: "error",
          message: asMessage(
            options.error,
            error instanceof Error ? error.message : "Error en la operación",
            error
          ),
          title: "Error",
        });
      });

    return heroToast.promise(operation, options);
  },

  message: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: getTitle(options?.description, "Información"),
    });
    return heroToast(message, options);
  },

  dismiss: heroToast.clear,
};
