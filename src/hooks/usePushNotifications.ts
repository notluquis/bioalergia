import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const VAPID_PUBLIC_KEY = "BIR7uwHD5foPZBVAKlBmngo2Ps1YTgsxJktvTmGeVq0bl7xZbQU76cpBXeVAEUzVX-OA0apUrovjSGrIeG9ggYI"; // Generated VAPID key

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
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

  const subscribeUser = async () => {
    if (!user) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Send subscription to server
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription,
          userId: user.id,
        }),
      });

      setIsSubscribed(true);
      setPermission("granted");
      alert("¡Notificaciones activadas!");
    } catch (error) {
      console.error("Failed to subscribe the user: ", error);
      alert("Error al activar notificaciones. Verifica los permisos del navegador.");
    }
  };

  const unsubscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch("/api/notifications/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        setIsSubscribed(false);
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
    if (!user) return;
    try {
      await fetch("/api/notifications/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch (error) {
      console.error("Error sending test notification", error);
    }
  };

  return {
    isSubscribed,
    permission,
    toggleSubscription,
    sendTestNotification,
  };
}
