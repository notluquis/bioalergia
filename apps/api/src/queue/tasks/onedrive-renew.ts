// graphile-worker task: renew Microsoft OneDrive subscriptions.
// Triggered every 6h (gated by ENABLE_SKIN_TEST_IMPORT_SYNC). OneDrive personal
// subscriptions expire in max 3 days; 4x/day renewal gives ample safety margin.

import type { Task } from "graphile-worker";
import { renewAllOneDriveSubscriptions } from "../../lib/microsoft/onedrive.ts";

export const onedrive_renew: Task = async (_payload, helpers) => {
  helpers.logger.info("onedrive_renew.start");
  await renewAllOneDriveSubscriptions();
};
