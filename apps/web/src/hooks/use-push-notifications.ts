import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  sendTestNotification as sendTestNotificationApi,
  subscribeToNotifications,
  unsubscribeFromNotifications,
} from "@/features/notifications/api";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { error: toastError, success: toastSuccess } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { user } = useAuth();

  useEffect(() => {
    if ("Notification" in globalThis) {
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
    onError: (error) => {
      console.error("Error subscribing to push:", error);
      toastError("Error al activar notificaciones. Verifica los permisos del navegador.");
    },
    onSuccess: () => {
      setIsSubscribed(true);
      setPermission("granted");
      toastSuccess("¡Notificaciones activadas!");
    },
  });

  const unsubscribeMutation = useMutation({
    mutationFn: async (endpoint: string) => {
      await unsubscribeFromNotifications({ endpoint });
    },
    onError: (error) => {
      console.error("Error unsubscribing", error);
    },
    onSuccess: () => {
      setIsSubscribed(false);
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
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        userVisibleOnly: true,
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
    loading: subscribeMutation.isPending || unsubscribeMutation.isPending || sendTestMutation.isPending,
    permission,
    sendTestNotification,
    toggleSubscription,
  };
}

function urlBase64ToUint8Array(base64String: string) {
  try {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replaceAll("-", "+").replaceAll("_", "/");

    const rawData = globalThis.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.codePointAt(i) ?? 0;
    }
    return outputArray;
  } catch (error) {
    console.error("Error decoding VAPID key:", error);
    return new Uint8Array(0);
  }
}
