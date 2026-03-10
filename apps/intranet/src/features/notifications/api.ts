import { z } from "zod";
import { notificationsORPCClient, toNotificationsApiError } from "./orpc";

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
  try {
    return StatusResponseSchema.parse(await notificationsORPCClient.sendTest(payload));
  } catch (error) {
    throw toNotificationsApiError(error);
  }
}

export async function subscribeToNotifications(payload: SubscribePayload) {
  try {
    return StatusResponseSchema.parse(
      await notificationsORPCClient.subscribe({
        subscription: payload.subscription.toJSON(),
        userId: payload.userId,
      }),
    );
  } catch (error) {
    throw toNotificationsApiError(error);
  }
}

export async function unsubscribeFromNotifications(payload: UnsubscribePayload) {
  try {
    return StatusResponseSchema.parse(await notificationsORPCClient.unsubscribe(payload));
  } catch (error) {
    throw toNotificationsApiError(error);
  }
}
