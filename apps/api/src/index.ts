// apps/api/src/index.ts - Server Entry Point
import { serve } from "@hono/node-server";
import app from "./app";
import { startGoogleCalendarScheduler } from "./lib/google/google-calendar-scheduler";
import { scheduleWatchChannelSetup } from "./lib/google/google-calendar-watch";
import { startMercadoPagoScheduler } from "./lib/mercadopago/mercadopago-scheduler";

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API starting on port ${port}`);

// Initialize Calendar features (Scheduler + Watch Channels)
// Run this after server starts to avoid blocking startup (though these are async anyway)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_CALENDAR_SYNC === "true") {
  startGoogleCalendarScheduler();
  scheduleWatchChannelSetup();
}

if (process.env.NODE_ENV === "production" || process.env.ENABLE_MP_AUTO_SYNC === "true") {
  startMercadoPagoScheduler();
}

serve({ fetch: app.fetch, port });
