/**
 * Backup Scheduler - Incremental Change-Based Backups
 *
 * Instead of full backups on schedule, this exports only NEW changes
 * to Google Drive. If no changes, it skips the export.
 *
 * Schedule:
 * - Hourly from 10:00 to 22:00, Monday to Saturday
 * - Once per day at 03:00 for Sunday and outside business hours
 */

import cron from "node-cron";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logEvent, logWarn } from "../../lib/logger.js";
import { isOAuthConfigured } from "../../lib/google-core.js";
import { uploadToDrive } from "./drive.js";
import { getPendingChanges, getPendingChangesCount, markAsExported, formatChangesForExport } from "../audit/index.js";

let businessHoursCron: cron.ScheduledTask | null = null;
let offHoursCron: cron.ScheduledTask | null = null;

/**
 * Exports pending audit changes to Google Drive as JSONL file.
 * Only exports if there are new changes.
 * Uses existing uploadToDrive function for consistency.
 */
async function exportIncrementalChanges(): Promise<void> {
  const pendingCount = await getPendingChangesCount();

  if (pendingCount === 0) {
    logEvent("backup.scheduler.no_changes", { message: "No changes to export" });
    return;
  }

  logEvent("backup.scheduler.exporting", { pendingCount });

  // Create temp file
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `audit_${timestamp}_${pendingCount}changes.jsonl`;
  const tempPath = join(tmpdir(), filename);

  try {
    // Get all pending changes
    const changes = await getPendingChanges();

    // Format as JSONL and write to temp file
    const content = formatChangesForExport(changes);
    writeFileSync(tempPath, content, "utf-8");

    // Upload using existing drive service (includes error handling)
    const upload = await uploadToDrive(tempPath, filename);

    // Mark as exported
    const ids = changes.map((c) => c.id);
    await markAsExported(ids);

    const sizeKB = Math.round(Buffer.byteLength(content, "utf-8") / 1024);
    logEvent("backup.scheduler.exported", {
      filename,
      fileId: upload.fileId,
      changes: changes.length,
      sizeKB,
    });
  } catch (error) {
    logWarn("backup.scheduler.export_failed", { error: String(error) });
    throw error;
  } finally {
    // Cleanup temp file
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Initializes the backup scheduler with the following schedule:
 * - Every hour from 10:00-22:00, Mon-Sat
 * - Once at 03:00 daily (covers Sunday and overnight)
 *
 * Exports only NEW changes (incremental), not full backups.
 */
export function initializeBackupScheduler(): void {
  if (!isOAuthConfigured()) {
    logWarn("backup.scheduler.skipped", {
      reason: "OAuth not configured - backups disabled",
    });
    return;
  }

  // Business hours: Every hour from 10:00-22:00, Mon-Sat
  businessHoursCron = cron.schedule("0 10-22 * * 1-6", async () => {
    logEvent("backup.scheduler.triggered", { schedule: "business_hours" });
    try {
      await exportIncrementalChanges();
    } catch (error) {
      logWarn("backup.scheduler.failed", { error: String(error) });
    }
  });

  // Off-hours: Once at 03:00 daily
  offHoursCron = cron.schedule("0 3 * * *", async () => {
    logEvent("backup.scheduler.triggered", { schedule: "off_hours" });
    try {
      await exportIncrementalChanges();
    } catch (error) {
      logWarn("backup.scheduler.failed", { error: String(error) });
    }
  });

  logEvent("backup.scheduler.started", {
    mode: "incremental",
    businessHours: "Mon-Sat 10:00-22:00 hourly",
    offHours: "Daily at 03:00",
  });
}

/**
 * Stops all backup scheduler jobs (for graceful shutdown).
 */
export function stopBackupScheduler(): void {
  if (businessHoursCron) {
    businessHoursCron.stop();
    businessHoursCron = null;
  }
  if (offHoursCron) {
    offHoursCron.stop();
    offHoursCron = null;
  }
  logEvent("backup.scheduler.stopped", {});
}

/**
 * Gets the current scheduler status.
 */
export function getBackupSchedulerStatus(): {
  enabled: boolean;
  mode: string;
  nextBusinessHours: string | null;
  nextOffHours: string | null;
} {
  return {
    enabled: businessHoursCron !== null,
    mode: "incremental",
    nextBusinessHours: businessHoursCron ? "Hourly 10:00-22:00 Mon-Sat" : null,
    nextOffHours: offHoursCron ? "Daily at 03:00" : null,
  };
}

/**
 * Manually trigger an incremental export (for testing/manual runs).
 */
export async function triggerIncrementalExport(): Promise<{ success: boolean; message: string }> {
  try {
    await exportIncrementalChanges();
    return { success: true, message: "Incremental export completed" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}
