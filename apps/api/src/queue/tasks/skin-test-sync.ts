// graphile-worker task: clinical skin-test import sync.
// Triggered by parsedCronItems (gated by ENABLE_SKIN_TEST_IMPORT_SYNC).
// Replaces the node-cron schedule in services/clinical-skin-test-scheduler.ts;
// the job function itself (startClinicalSkinTestImportJob) is unchanged and
// still drives the in-process progress queue.

import type { Task } from "graphile-worker";
import { startClinicalSkinTestImportJob } from "../../services/clinical-skin-test-scheduler.ts";

export const skin_test_sync: Task = async (_payload, helpers) => {
  helpers.logger.info("skin_test_sync.start");
  await startClinicalSkinTestImportJob({ trigger: "cron:skin_test_sync" });
};
