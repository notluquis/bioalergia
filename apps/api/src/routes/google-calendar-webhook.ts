import { Hono } from "hono";
import { handleGoogleCalendarWebhook } from "./calendar.ts";

export const googleCalendarWebhookRoutes = new Hono();

// Golden standard: dedicated webhook ingress for external providers.
// Keep no-auth because Google push notifications cannot send app credentials.
googleCalendarWebhookRoutes.post("/calendar", handleGoogleCalendarWebhook);
