import { z } from "zod";
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

const StatusResponseSchema = z.looseObject({ status: z.string().optional() });

export async function sendTestNotification(payload: SendTestPayload) {
  return apiClient.post("/api/notifications/send-test", payload, {
    responseSchema: StatusResponseSchema,
  });
}

export async function subscribeToNotifications(payload: SubscribePayload) {
  return apiClient.post("/api/notifications/subscribe", payload, {
    responseSchema: StatusResponseSchema,
  });
}

export async function unsubscribeFromNotifications(payload: UnsubscribePayload) {
  return apiClient.post("/api/notifications/unsubscribe", payload, {
    responseSchema: StatusResponseSchema,
  });
}
