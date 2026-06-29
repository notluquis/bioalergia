// graphile-worker task: expire stale stock reservations whose TTL has passed,
// returning held stock to availability. Without this, a declined/abandoned
// Checkout Pro attempt (which we deliberately do NOT release on `rejected`) would
// stay ACTIVE until the next checkout's lazy cleanup — trapping stock on a
// low-traffic store. Runs on an interval cron.

import type { Task } from "graphile-worker";
import { logEvent } from "../../lib/logger.ts";
import { sweepExpiredReservations } from "../../modules/reservations/index.ts";

export const reservation_sweep: Task = async (_payload, helpers) => {
  const started = Date.now();
  helpers.logger.info("reservation_sweep.start");
  const expired = await sweepExpiredReservations();
  logEvent("queue.reservation_sweep.done", { ms: Date.now() - started, expired });
};
