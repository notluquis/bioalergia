import { getSetting } from "../lib/settings.ts";
import { logEvent } from "../lib/logger.ts";
import { runBackfillGuardians } from "./backfill-guardians.ts";
import { runBackfillOrphanSeries } from "./backfill-orphan-series.ts";
import { runDoctoraliaIdentitySync } from "./doctoralia-identity-sync.ts";
import { syncPatientDteSaleSources } from "./patients-router.ts";

// ---------------------------------------------------------------------------
// Event-driven identity feeders. Instead of a separate nightly cron scanning
// everything, these ride the EXISTING sync tasks (doctoralia_calendar_sync,
// dte_sync): each runs right after new source data lands, in INCREMENTAL mode
// (only unlinked rows), so cost is O(new) not O(all).
//
// Toggle lives in the DB (Setting key), not an env var — flip
// `identity_feeders_enabled` to "false" to disable. Absent/anything-else = ON.
// ---------------------------------------------------------------------------

const TOGGLE_KEY = "identity_feeders_enabled";

async function feedersEnabled(): Promise<boolean> {
  return (await getSetting(TOGGLE_KEY)) !== "false";
}

/** Called at the tail of doctoralia_calendar_sync — link fresh appointments +
 *  tidy the series graph. All idempotent + incremental. */
export async function feedDoctoraliaIdentity(trigger: string): Promise<void> {
  if (!(await feedersEnabled())) {
    logEvent("identity-feeders.doctoralia.skipped", { trigger });
    return;
  }
  const started = Date.now();
  const doctoralia = await runDoctoraliaIdentitySync({ dryRun: false, onlyUnlinked: true });
  const orphans = await runBackfillOrphanSeries({ dryRun: false });
  const guardians = await runBackfillGuardians({ dryRun: false });
  logEvent("identity-feeders.doctoralia.done", {
    trigger,
    ms: Date.now() - started,
    doctoralia,
    orphans,
    guardians,
  });
}

/** Called at the tail of dte_sync — resolve boleta titulares into the bridge.
 *  Idempotent (bridge upsert). */
export async function feedDteTitular(trigger: string): Promise<void> {
  if (!(await feedersEnabled())) {
    logEvent("identity-feeders.dte.skipped", { trigger });
    return;
  }
  const started = Date.now();
  const result = await syncPatientDteSaleSources({ dryRun: false, resolveTitular: true });
  logEvent("identity-feeders.dte.done", { trigger, ms: Date.now() - started, ...result });
}
