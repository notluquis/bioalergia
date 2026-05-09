import cron from "node-cron";
import { logError, logEvent, logWarn } from "../logger.ts";
import { runImapPoll } from "./imap-monitor.ts";

const DEFAULT_CRON = "*/2 * * * *";
const DEFAULT_TIMEZONE = "America/Santiago";

let isRunning = false;

export function startWhatsappScheduler() {
  const cronExpression = process.env.WHATSAPP_POLL_CRON ?? DEFAULT_CRON;
  const timezone = process.env.WHATSAPP_POLL_TIMEZONE ?? DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    logWarn("whatsapp.scheduler.disabled", {
      cronExpression,
      reason: "invalid_cron",
    });
    return;
  }

  cron.schedule(
    cronExpression,
    async () => {
      await runWhatsappPoll({ trigger: `cron:${cronExpression}` });
    },
    { timezone },
  );

  logEvent("whatsapp.scheduler.started", { cronExpression, timezone });
}

export async function runWhatsappPoll({ trigger }: { trigger: string }) {
  if (isRunning) {
    logWarn("whatsapp.poll.skip", { reason: "already_running", trigger });
    return null;
  }

  isRunning = true;
  try {
    logEvent("whatsapp.poll.start", { trigger });
    const result = await runImapPoll();
    logEvent("whatsapp.poll.done", { ...result, trigger });
    return result;
  } catch (err) {
    logError("whatsapp.poll.error", err, { trigger });
    return null;
  } finally {
    isRunning = false;
  }
}
