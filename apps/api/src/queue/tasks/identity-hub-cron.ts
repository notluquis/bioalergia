// graphile-worker tasks: nightly identity-hub feeders. Keep Person/Patient fed
// as new Doctoralia appointments / DTE boletas / clinical series arrive, without
// re-running the manual scripts. All idempotent (dedup by external_id/rut), so a
// full nightly re-scan only materializes genuinely new identities.
//
// Gated OFF by default: set IDENTITY_FEEDERS_ENABLED=true on the Railway api
// service to activate (safe rollout — the initial backfill was already run
// manually). DISABLE_QUEUE_RUNNER=true kills the whole queue as the bigger hammer.
import type { Task } from "graphile-worker";
import { logEvent } from "../../lib/logger.ts";
import { runBackfillGuardians } from "../../services/backfill-guardians.ts";
import { runBackfillOrphanSeries } from "../../services/backfill-orphan-series.ts";
import { runDoctoraliaIdentitySync } from "../../services/doctoralia-identity-sync.ts";
import { syncPatientDteSaleSources } from "../../services/patients-router.ts";

function feedersEnabled(): boolean {
  return process.env.IDENTITY_FEEDERS_ENABLED === "true";
}

export const doctoralia_identity_sync: Task = async (_payload, helpers) => {
  if (!feedersEnabled()) {
    logEvent("queue.doctoralia_identity_sync.skipped", { reason: "IDENTITY_FEEDERS_ENABLED!=true" });
    return;
  }
  const started = Date.now();
  helpers.logger.info("doctoralia_identity_sync.start");
  const result = await runDoctoraliaIdentitySync({ dryRun: false });
  logEvent("queue.doctoralia_identity_sync.done", { ms: Date.now() - started, ...result });
};

export const dte_titular_sync: Task = async (_payload, helpers) => {
  if (!feedersEnabled()) {
    logEvent("queue.dte_titular_sync.skipped", { reason: "IDENTITY_FEEDERS_ENABLED!=true" });
    return;
  }
  const started = Date.now();
  helpers.logger.info("dte_titular_sync.start");
  const result = await syncPatientDteSaleSources({ dryRun: false, resolveTitular: true });
  logEvent("queue.dte_titular_sync.done", { ms: Date.now() - started, ...result });
};

export const identity_series_backfill: Task = async (_payload, helpers) => {
  if (!feedersEnabled()) {
    logEvent("queue.identity_series_backfill.skipped", { reason: "IDENTITY_FEEDERS_ENABLED!=true" });
    return;
  }
  const started = Date.now();
  helpers.logger.info("identity_series_backfill.start");
  const orphans = await runBackfillOrphanSeries({ dryRun: false });
  const guardians = await runBackfillGuardians({ dryRun: false });
  logEvent("queue.identity_series_backfill.done", { ms: Date.now() - started, orphans, guardians });
};
