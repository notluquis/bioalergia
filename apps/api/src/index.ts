// apps/api/src/index.ts - Server Entry Point
import { serve } from "@hono/node-server";
import { app } from "./app";
import { startDoctoraliaCalendarScheduler } from "./lib/doctoralia/doctoralia-calendar-scheduler";
import { startDoctoraliaImapListener } from "./lib/doctoralia/imap-idle";
import { startDTESyncScheduler } from "./lib/dte/dte-sync-cron";
import { startClinicalSkinTestImportScheduler } from "./lib/clinical-skin-tests/clinical-skin-test-scheduler";
import { startGoogleCalendarScheduler } from "./lib/google/google-calendar-scheduler";
import { scheduleWatchChannelSetup } from "./lib/google/google-calendar-watch";
import { initBaileysSocket } from "./lib/whatsapp/baileys-socket";
import { startWhatsappScheduler } from "./lib/whatsapp/whatsapp-scheduler";
import { getSetting } from "./services/settings";

const port = Number(process.env.PORT) || 3000;
console.log(`🚀 Finanzas API starting on port ${port}`);

// Initialize Calendar features (Scheduler + Watch Channels)
// Run this after server starts to avoid blocking startup (though these are async anyway)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_CALENDAR_SYNC === "true") {
  startGoogleCalendarScheduler();
  scheduleWatchChannelSetup();
}

// DTE Sync Scheduler (daily at 17:00)
if (process.env.NODE_ENV === "production" || process.env.ENABLE_DTE_AUTO_SYNC === "true") {
  startDTESyncScheduler();
}

if (process.env.ENABLE_DOCTORALIA_CALENDAR_SYNC === "true") {
  startDoctoraliaCalendarScheduler();
}

// Initialize Baileys WhatsApp connection if enabled and has stored credentials
getSetting("whatsapp.enabled").then(async (val) => {
  if (val !== "true") return;
  const { hasStoredCreds } = await import("./lib/whatsapp/baileys-auth-state");
  if (await hasStoredCreds()) {
    initBaileysSocket().catch((err) => console.error("Failed to initialize Baileys:", err));
  } else {
    console.log("[Baileys] No stored credentials — skipping auto-init. Scan QR from settings page.");
  }
}).catch(() => {});

if (process.env.ENABLE_WHATSAPP_NOTIFICATIONS === "true") {
  startWhatsappScheduler();
}

if (process.env.ENABLE_DOCTORALIA_IMAP === "true") {
  startDoctoraliaImapListener();
}

if (process.env.ENABLE_SKIN_TEST_IMPORT_SYNC === "true") {
  startClinicalSkinTestImportScheduler();
}

serve({ fetch: app.fetch, port });
