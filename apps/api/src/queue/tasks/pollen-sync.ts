// graphile-worker task: refresca el cache diario de polen (gramíneas en vivo
// desde la Google Pollen API). Disparado por cron a las 06:00 America/Santiago.
// No-op silencioso si falta GOOGLE_PLACES_API_KEY (queda solo el calendario).

import type { Task } from "graphile-worker";
import { logError, logEvent } from "../../lib/logger.ts";
import { syncPollenForecast } from "../../services/pollen.ts";

export const pollen_sync: Task = async (_payload, helpers) => {
  helpers.logger.info("pollen_sync.start");
  try {
    const { days } = await syncPollenForecast();
    logEvent("queue.pollen_sync.done", { days });
  } catch (err) {
    // No reventar el worker: el widget cae al calendario si no hay cache fresco.
    logError(err, { module: "api", operation: "queue.pollen_sync" });
  }
};
