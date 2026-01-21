// apps/api/src/index.ts - Server Entry Point
import { serve } from "@hono/node-server";
import app from "./app";
import { startGoogleCalendarScheduler } from "./lib/google/google-calendar-scheduler";
import { setupAllWatchChannels } from "./lib/google/google-calendar-watch";

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API starting on port ${port}`);

// Initialize Calendar features (Scheduler + Watch Channels)
// Run this after server starts to avoid blocking startup (though these are async anyway)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_CALENDAR_SYNC === "true") {
  startGoogleCalendarScheduler();
  setupAllWatchChannels().catch((err) => {
    console.error("Failed to setup watch channels:", err);
  });
}

serve({ fetch: app.fetch, port });
