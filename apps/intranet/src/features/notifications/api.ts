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
    const subscription = payload.subscription.toJSON();
    const auth = subscription.keys?.auth;
    const p256dh = subscription.keys?.p256dh;

    if (!subscription.endpoint || !auth || !p256dh) {
      throw new Error("Suscripción push incompleta");
    }

    return StatusResponseSchema.parse(
      await notificationsORPCClient.subscribe({
        subscription: {
          endpoint: subscription.endpoint,
          keys: { auth, p256dh },
        },
        userId: payload.userId,
      })
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

const PreviewModeResponseSchema = z.object({
  mode: z.enum(["GENERIC", "SENDER_NAME", "FULL"]),
});
export type PushPreviewMode = z.infer<typeof PreviewModeResponseSchema>["mode"];

export async function getPushPreviewMode() {
  try {
    return PreviewModeResponseSchema.parse(await notificationsORPCClient.getPreviewMode());
  } catch (error) {
    throw toNotificationsApiError(error);
  }
}

export async function setPushPreviewMode(mode: PushPreviewMode) {
  try {
    return StatusResponseSchema.parse(await notificationsORPCClient.setPreviewMode({ mode }));
  } catch (error) {
    throw toNotificationsApiError(error);
  }
}
