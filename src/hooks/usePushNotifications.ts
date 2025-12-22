import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  subscribeToNotifications,
  unsubscribeFromNotifications,
  sendTestNotification as sendTestNotificationApi,
} from "@/features/notifications/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string) {
  try {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.error("Error decoding VAPID key:", e);
    return new Uint8Array(0);
  }
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { user } = useAuth();

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }
  };

  const subscribeMutation = useMutation({
    mutationFn: async (subscription: PushSubscription) => {
      if (!user) throw new Error("No authenticated user");
      await subscribeToNotifications({
        subscription,
        userId: user.id,
      });
    },
    onSuccess: () => {
      setIsSubscribed(true);
      setPermission("granted");
      toastSuccess("¡Notificaciones activadas!");
    },
    onError: (error) => {
      console.error("Error subscribing to push:", error);
      toastError("Error al activar notificaciones. Verifica los permisos del navegador.");
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      await unsubscribeFromNotifications({ endpoint });
    },
    onSuccess: () => {
      setIsSubscribed(false);
    },
    onError: (error) => {
      console.error("Error unsubscribing", error);
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await sendTestNotificationApi({ userId: user.id });
    },
    onError: (error) => {
      console.error("Error sending test notification", error);
    },
  });

  const subscribeUser = async () => {
    if (!user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      subscribeMutation.mutate(subscription);
    } catch (error) {
      console.error("Error subscribing to push:", error);
      toastError("Error al activar notificaciones. Verifica los permisos del navegador.");
    }
  };

  const unsubscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        unsubscribeMutation.mutate(subscription.endpoint);
      }
    } catch (error) {
      console.error("Error unsubscribing", error);
    }
  };

  const toggleSubscription = async () => {
    if (isSubscribed) {
      await unsubscribeUser();
    } else {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        await subscribeUser();
      }
    }
  };

  const sendTestNotification = async () => {
    sendTestMutation.mutate();
  };

  return {
    isSubscribed,
    permission,
    toggleSubscription,
    sendTestNotification,
    loading: subscribeMutation.isPending || unsubscribeMutation.isPending || sendTestMutation.isPending,
  };
}
