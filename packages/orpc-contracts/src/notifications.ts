import { oc } from "@orpc/contract";
import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
});

export const notificationsStatusResponseSchema = z.object({
  message: z.string().optional(),
  sent: z.number().optional(),
  status: z.string().optional(),
  success: z.boolean().optional(),
});

export const subscribeInputSchema = z.object({
  subscription: pushSubscriptionSchema,
  userId: z.number().int().optional(),
});

export const unsubscribeInputSchema = z.object({
  endpoint: z.string().url(),
});

export const sendTestInputSchema = z.object({
  userId: z.number().int().optional(),
});

export const notificationsContract = {
  sendTest: oc
    .route({ method: "POST", path: "/send-test" })
    .input(sendTestInputSchema)
    .output(notificationsStatusResponseSchema),
  subscribe: oc
    .route({ method: "POST", path: "/subscribe" })
    .input(subscribeInputSchema)
    .output(notificationsStatusResponseSchema),
  unsubscribe: oc
    .route({ method: "POST", path: "/unsubscribe" })
    .input(unsubscribeInputSchema)
    .output(notificationsStatusResponseSchema),
};

export type NotificationsContract = typeof notificationsContract;
