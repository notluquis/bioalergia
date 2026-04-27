import cron from "node-cron";
import {
  getSkinTestImportJobType,
  processDiscoveredSkinTestImports,
  syncClinicalSkinTestImports,
} from "../../services/clinical-skin-test-imports";
import {
  cancelJob,
  completeJob,
  failJob,
  getActiveJobsByType,
  isJobCancelled,
  startJob,
  updateJobProgress,
} from "../jobQueue";
import { logError, logEvent, logWarn } from "../logger";
import { renewAllOneDriveSubscriptions } from "../microsoft/onedrive";

const DEFAULT_CRON = "*/30 * * * *";
const DEFAULT_TIMEZONE = "America/Santiago";

export function startClinicalSkinTestImportScheduler() {
  const cronExpression = process.env.SKIN_TEST_IMPORT_SYNC_CRON || DEFAULT_CRON;
  const timezone = process.env.SKIN_TEST_IMPORT_SYNC_TIMEZONE || DEFAULT_TIMEZONE;

  if (!cron.validate(cronExpression)) {
    logWarn("clinicalSkinTests.scheduler.disabled", {
      cronExpression,
      reason: "invalid_cron",
    });
    return;
  }

  cron.schedule(
    cronExpression,
    () => {
      void startClinicalSkinTestImportJob({ trigger: `cron:${cronExpression}` });
    },
    { timezone }
  );

  // Renew Microsoft OneDrive subscriptions every 6h.
  // OneDrive personal subscriptions expire in max 3 days — daily renewal risks
  // a 24h outage if the nightly cron fails once. 4x/day gives ample safety margin.
  cron.schedule(
    "0 */6 * * *",
    () => {
      void renewAllOneDriveSubscriptions().catch((error) => {
        logError("onedrive.subscriptions.renew.failed", error);
      });
    },
    { timezone }
  );

  logEvent("clinicalSkinTests.scheduler.started", { cronExpression, timezone });
}

export async function startClinicalSkinTestImportJob(options?: {
  accountId?: string;
  folderDriveId?: null | string;
  folderItemId?: null | string;
  folderPath?: string;
  force?: boolean;
  trigger?: string;
}): Promise<string> {
  const jobType = getSkinTestImportJobType();
  const activeJobs = getActiveJobsByType(jobType);
  if (activeJobs.length > 0) {
    return activeJobs[0].id;
  }

  const jobId = startJob(jobType, 1);
  updateJobProgress(jobId, 0, "Preparando sincronización de tests cutáneos", {
    phase: "starting",
  });
  let progressPhase: string | null = "starting";
  let progressTotal = 1;
  let phaseStartedAt = Date.now();
  let phaseStartedAtProgress = 0;

  void (async () => {
    try {
      const result = await syncClinicalSkinTestImports({
        accountId: options?.accountId,
        folderDriveId: options?.folderDriveId,
        folderItemId: options?.folderItemId,
        folderPath: options?.folderPath,
        force: options?.force,
        shouldCancel: () => isJobCancelled(jobId),
        onProgress: ({ message, processed, total, ...meta }) => {
          const phase = typeof meta.phase === "string" ? meta.phase : null;
          if (
            phase !== progressPhase ||
            total !== progressTotal ||
            processed < phaseStartedAtProgress
          ) {
            progressPhase = phase;
            progressTotal = total;
            phaseStartedAt = Date.now();
            phaseStartedAtProgress = processed;
          }

          const elapsedSeconds = Math.max(0, (Date.now() - phaseStartedAt) / 1000);
          const completedInPhase = processed - phaseStartedAtProgress;
          const remainingInPhase = total - processed;
          const etaSeconds =
            completedInPhase > 0 && remainingInPhase > 0 && elapsedSeconds >= 2
              ? Math.round((elapsedSeconds / completedInPhase) * remainingInPhase)
              : null;

          updateJobProgress(
            jobId,
            processed,
            message,
            {
              ...meta,
              elapsedSeconds: Math.round(elapsedSeconds),
              etaSeconds,
            },
            total
          );
        },
      });
      completeJob(jobId, result, "Sincronización de tests cutáneos completada", {
        ...result,
        phase: "completed",
      });
      logEvent("clinicalSkinTests.sync.completed", {
        result,
        trigger: options?.trigger ?? "manual",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "SYNC_CANCELLED") {
        cancelJob(jobId, "Sincronización cancelada por usuario");
        logEvent("clinicalSkinTests.sync.cancelled", {
          trigger: options?.trigger ?? "manual",
        });
        return;
      }

      failJob(jobId, message);
      logError("clinicalSkinTests.sync.failed", error, {
        trigger: options?.trigger ?? "manual",
      });
    }
  })();

  return jobId;
}

export async function startClinicalSkinTestProcessDiscoveredJob(options?: {
  query?: string;
  trigger?: string;
}): Promise<string> {
  const jobType = getSkinTestImportJobType();
  const activeJobs = getActiveJobsByType(jobType);
  if (activeJobs.length > 0) {
    return activeJobs[0].id;
  }

  const jobId = startJob(jobType, 1);
  updateJobProgress(jobId, 0, "Preparando descubiertos de tests cutáneos", {
    phase: "discovered-processing",
  });
  let progressTotal = 1;
  let phaseStartedAt = Date.now();
  let phaseStartedAtProgress = 0;

  void (async () => {
    try {
      const result = await processDiscoveredSkinTestImports({
        query: options?.query,
        shouldCancel: () => isJobCancelled(jobId),
        onProgress: ({ message, processed, total, ...meta }) => {
          if (total !== progressTotal || processed < phaseStartedAtProgress) {
            progressTotal = total;
            phaseStartedAt = Date.now();
            phaseStartedAtProgress = processed;
          }

          const elapsedSeconds = Math.max(0, (Date.now() - phaseStartedAt) / 1000);
          const completedInPhase = processed - phaseStartedAtProgress;
          const remainingInPhase = total - processed;
          const etaSeconds =
            completedInPhase > 0 && remainingInPhase > 0 && elapsedSeconds >= 2
              ? Math.round((elapsedSeconds / completedInPhase) * remainingInPhase)
              : null;

          updateJobProgress(
            jobId,
            processed,
            message,
            {
              ...meta,
              elapsedSeconds: Math.round(elapsedSeconds),
              etaSeconds,
              mode: "process-discovered",
            },
            total
          );
        },
      });
      completeJob(jobId, result, "Procesamiento de descubiertos completado", {
        ...result,
        mode: "process-discovered",
        phase: "completed",
      });
      logEvent("clinicalSkinTests.discoveredProcessing.completed", {
        result,
        trigger: options?.trigger ?? "manual",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === "SYNC_CANCELLED") {
        cancelJob(jobId, "Procesamiento cancelado por usuario");
        logEvent("clinicalSkinTests.discoveredProcessing.cancelled", {
          trigger: options?.trigger ?? "manual",
        });
        return;
      }

      failJob(jobId, message);
      logError("clinicalSkinTests.discoveredProcessing.failed", error, {
        trigger: options?.trigger ?? "manual",
      });
    }
  })();

  return jobId;
}
