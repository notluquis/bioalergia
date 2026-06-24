// graphile-worker task: sincroniza ofertas de empleo (Job Radar) y notifica
// nuevas vía Telegram. Gateado por ENABLE_JOB_RADAR en runner.ts.

import type { Task } from "graphile-worker";
import { syncJobRadar } from "../../services/job-radar.ts";
import { logEvent } from "../../lib/logger.ts";

export const job_radar_sync: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("job_radar_sync.start");
  const result = await syncJobRadar({ triggerSource: "cron" });
  logEvent("queue.job_radar_sync.done", { ms: Date.now() - started, ...result });
};
