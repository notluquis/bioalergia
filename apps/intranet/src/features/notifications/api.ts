import { apiClient } from "@/lib/api-client";

export interface SendTestPayload {
  userId: number;
}

export interface SubscribePayload {
  subscription: PushSubscription;
  userId: number;
}

export interface UnsubscribePayload {
  endpoint: string;
}

export async function sendTestNotification(payload: SendTestPayload) {
  return apiClient.post("/api/notifications/send-test", payload);
}

export async function subscribeToNotifications(payload: SubscribePayload) {
  return apiClient.post("/api/notifications/subscribe", payload);
}

export async function unsubscribeFromNotifications(payload: UnsubscribePayload) {
  return apiClient.post("/api/notifications/unsubscribe", payload);
}
