// graphile-worker task: sincroniza ofertas de empleo (Job Radar) y notifica
// nuevas vía Telegram. Gateado por ENABLE_JOB_RADAR en runner.ts.

import type { Task } from "graphile-worker";
import { markJobRadarSyncFailed, syncJobRadar } from "../../services/job-radar.ts";
import { logError, logEvent } from "../../lib/logger.ts";

export const job_radar_sync: Task = async (payload, helpers) => {
  const started = Date.now();
  const triggerSource =
    typeof payload === "object" &&
    payload !== null &&
    "triggerSource" in payload &&
    payload.triggerSource === "manual"
      ? "manual"
      : "cron";
  helpers.logger.info("job_radar_sync.start");
  try {
    const result = await syncJobRadar({ triggerSource });
    logEvent("queue.job_radar_sync.done", { ms: Date.now() - started, ...result });
  } catch (error) {
    markJobRadarSyncFailed();
    logError("queue.job_radar_sync.failed", error, { ms: Date.now() - started, triggerSource });
    throw error;
  }
};
