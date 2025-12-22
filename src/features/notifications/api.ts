import { apiClient } from "@/lib/apiClient";

export interface SubscribePayload {
  subscription: PushSubscription;
  userId: number;
}

export interface UnsubscribePayload {
  endpoint: string;
}

export interface SendTestPayload {
  userId: number;
}

export async function subscribeToNotifications(payload: SubscribePayload) {
  return apiClient.post("/api/notifications/subscribe", payload);
}

export async function unsubscribeFromNotifications(payload: UnsubscribePayload) {
  return apiClient.post("/api/notifications/unsubscribe", payload);
}

export async function sendTestNotification(payload: SendTestPayload) {
  return apiClient.post("/api/notifications/send-test", payload);
}
