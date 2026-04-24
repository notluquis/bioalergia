import cron from "node-cron";
import {
  getSkinTestImportJobType,
  syncClinicalSkinTestImports,
} from "../../services/clinical-skin-test-imports";
import {
  completeJob,
  failJob,
  getActiveJobsByType,
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
    { timezone },
  );

  // Daily cron to renew Microsoft OneDrive subscriptions (runs at 4:00 AM)
  cron.schedule(
    "0 4 * * *",
    () => {
      void renewAllOneDriveSubscriptions().catch(error => {
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
  updateJobProgress(jobId, 0, "Iniciando sincronización de tests cutáneos");

  void (async () => {
    try {
      const result = await syncClinicalSkinTestImports({
        accountId: options?.accountId,
        folderDriveId: options?.folderDriveId,
        folderItemId: options?.folderItemId,
        folderPath: options?.folderPath,
        force: options?.force,
        onProgress: (processed, total, message) => {
          updateJobProgress(jobId, processed, message);
          const job = getActiveJobsByType(jobType).find((item) => item.id === jobId);
          if (job) {
            job.total = total;
          }
        },
      });
      completeJob(jobId, result);
      logEvent("clinicalSkinTests.sync.completed", {
        result,
        trigger: options?.trigger ?? "manual",
      });
    } catch (error) {
      failJob(jobId, error instanceof Error ? error.message : String(error));
      logError("clinicalSkinTests.sync.failed", error, {
        trigger: options?.trigger ?? "manual",
      });
    }
  })();

  return jobId;
}
