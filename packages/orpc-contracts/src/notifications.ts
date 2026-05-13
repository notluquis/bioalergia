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

// Used by the service worker `pushsubscriptionchange` handler when the
// user agent rotates a subscription endpoint. The old endpoint acts as
// proof-of-possession: only a client that already held the previous
// subscription can know it, and the server matches it against an
// existing row before swapping. No session cookie is required because
// SW background fetches don't always carry one (Safari iOS sometimes
// strips them when the subscription is renewed in the background).
export const rotateInputSchema = z.object({
  oldEndpoint: z.string().url(),
  subscription: pushSubscriptionSchema,
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
  rotate: oc
    .route({ method: "POST", path: "/rotate" })
    .input(rotateInputSchema)
    .output(notificationsStatusResponseSchema),
};

export type NotificationsContract = typeof notificationsContract;
