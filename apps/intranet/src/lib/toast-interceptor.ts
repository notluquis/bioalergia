/**
 * Global toast interceptor that automatically persists all toasts to notification history.
 * Use this instead of importing toast directly from 'sonner'.
 */

import { toast as sonnerToast } from "sonner";
import { addNotification } from "@/features/notifications/store/use-notification-store";

type ToastOptions = Parameters<typeof sonnerToast.success>[1];

/**
 * Wrapper around Sonner's toast that automatically saves to notification history.
 * Maps Sonner toast types to notification types.
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "success",
      message,
      title: options?.description ? String(options.description) : "Éxito",
    });
    return sonnerToast.success(message, options);
  },

  error: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "error",
      message,
      title: options?.description ? String(options.description) : "Error",
    });
    return sonnerToast.error(message, options);
  },

  info: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "info",
      message,
      title: options?.description ? String(options.description) : "Información",
    });
    return sonnerToast.info(message, options);
  },

  warning: (message: string, options?: ToastOptions) => {
    addNotification({
      type: "warning",
      message,
      title: options?.description ? String(options.description) : "Advertencia",
    });
    return sonnerToast.warning(message, options);
  },

  // Passthrough for other methods
  loading: (message: string, options?: ToastOptions) => sonnerToast.loading(message, options),
  dismiss: sonnerToast.dismiss,
  promise: sonnerToast.promise,
  message: sonnerToast.message,
};
