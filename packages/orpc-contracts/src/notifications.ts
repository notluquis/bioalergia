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

// SW `notificationclose` analytics. Tag is the OS-level grouping key
// the SW set when showing the notification (e.g. "wa-conv-42").
// conversationId is optional because not every push carries one.
export const dismissedInputSchema = z.object({
  tag: z.string().max(200).optional(),
  conversationId: z.number().int().positive().optional(),
});

// Output for the unread-count endpoint consumed by the SW
// periodicsync handler. Single integer — no extra metadata needed
// to paint the OS badge.
export const unreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

// Privacy gate for Web Push payloads. Mirrors the `WaPushPreviewMode`
// enum in the DB schema. Default GENERIC matches the HIPAA 2026 +
// Ley 21.719 recommendation that PHI never appears on a lock screen.
export const pushPreviewModeSchema = z.enum(["GENERIC", "SENDER_NAME", "FULL"]);
export type PushPreviewMode = z.infer<typeof pushPreviewModeSchema>;

export const previewModeResponseSchema = z.object({
  mode: pushPreviewModeSchema,
});

export const setPreviewModeInputSchema = z.object({
  mode: pushPreviewModeSchema,
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
  dismissed: oc
    .route({ method: "POST", path: "/dismissed" })
    .input(dismissedInputSchema)
    .output(notificationsStatusResponseSchema),
  unreadCount: oc
    .route({ method: "GET", path: "/unread-count" })
    .output(unreadCountResponseSchema),
  getPreviewMode: oc
    .route({ method: "GET", path: "/preview-mode" })
    .output(previewModeResponseSchema),
  setPreviewMode: oc
    .route({ method: "POST", path: "/preview-mode" })
    .input(setPreviewModeInputSchema)
    .output(notificationsStatusResponseSchema),
};

export type NotificationsContract = typeof notificationsContract;
