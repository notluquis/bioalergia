/**
 * Backup Scheduler - Hybrid Strategy
 *
 * Combines:
 * 1. Weekly FULL backup (Sunday 3am) - Complete database snapshot
 * 2. Hourly INCREMENTAL (Mon-Sat 10am-10pm) - Only new changes
 * 3. Daily INCREMENTAL (3am Mon-Sat) - Catch overnight changes
 *
 * This allows:
 * - Full disaster recovery from Sunday backup + incrementals
 * - Granular point-in-time recovery via audit logs
 */

import cron from "node-cron";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logEvent, logWarn } from "../../lib/logger.js";
import { isOAuthConfigured } from "../../lib/google-core.js";
import { uploadToDrive } from "./drive.js";
import { startBackup } from "./manager.js";
import { getPendingChanges, getPendingChangesCount, markAsExported, formatChangesForExport } from "../audit/index.js";

let businessHoursCron: cron.ScheduledTask | null = null;
let offHoursCron: cron.ScheduledTask | null = null;
let weeklyFullCron: cron.ScheduledTask | null = null;

/**
 * Exports pending audit changes to Google Drive as JSONL file.
 * Only exports if there are new changes.
 */
async function exportIncrementalChanges(): Promise<void> {
  const pendingCount = await getPendingChangesCount();

  if (pendingCount === 0) {
    logEvent("backup.scheduler.no_changes", { message: "No changes to export" });
    return;
  }

  logEvent("backup.scheduler.exporting", { pendingCount, type: "incremental" });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `audit_${timestamp}_${pendingCount}changes.jsonl`;
  const tempPath = join(tmpdir(), filename);

  try {
    const changes = await getPendingChanges();
    const content = formatChangesForExport(changes);
    writeFileSync(tempPath, content, "utf-8");

    const upload = await uploadToDrive(tempPath, filename);

    const ids = changes.map((c) => c.id);
    await markAsExported(ids);

    const sizeKB = Math.round(Buffer.byteLength(content, "utf-8") / 1024);
    logEvent("backup.scheduler.exported", {
      type: "incremental",
      filename,
      fileId: upload.fileId,
      changes: changes.length,
      sizeKB,
    });
  } catch (error) {
    logWarn("backup.scheduler.export_failed", { type: "incremental", error: String(error) });
    throw error;
  } finally {
    try {
      unlinkSync(tempPath);
    } catch {
      // Ignore
    }
  }
}

/**
 * Runs a full database backup (complete snapshot).
 */
async function runFullBackup(): Promise<void> {
  logEvent("backup.scheduler.triggered", { type: "full", schedule: "weekly" });
  try {
    await startBackup();
    logEvent("backup.scheduler.completed", { type: "full" });
  } catch (error) {
    logWarn("backup.scheduler.failed", { type: "full", error: String(error) });
  }
}

/**
 * Initializes the hybrid backup scheduler:
 * - Weekly FULL: Sunday 3am
 * - Hourly INCREMENTAL: Mon-Sat 10am-10pm
 * - Daily INCREMENTAL: Mon-Sat 3am (overnight changes)
 */
export function initializeBackupScheduler(): void {
  if (!isOAuthConfigured()) {
    logWarn("backup.scheduler.skipped", {
      reason: "OAuth not configured - backups disabled",
    });
    return;
  }

  // Weekly FULL backup: Sunday 3am
  weeklyFullCron = cron.schedule("0 3 * * 0", async () => {
    await runFullBackup();
  });

  // Business hours INCREMENTAL: Mon-Sat 10am-10pm hourly
  businessHoursCron = cron.schedule("0 10-22 * * 1-6", async () => {
    logEvent("backup.scheduler.triggered", { type: "incremental", schedule: "business_hours" });
    try {
      await exportIncrementalChanges();
    } catch (error) {
      logWarn("backup.scheduler.failed", { type: "incremental", error: String(error) });
    }
  });

  // Off-hours INCREMENTAL: Mon-Sat 3am (catch overnight changes)
  offHoursCron = cron.schedule("0 3 * * 1-6", async () => {
    logEvent("backup.scheduler.triggered", { type: "incremental", schedule: "off_hours" });
    try {
      await exportIncrementalChanges();
    } catch (error) {
      logWarn("backup.scheduler.failed", { type: "incremental", error: String(error) });
    }
  });

  logEvent("backup.scheduler.started", {
    strategy: "hybrid",
    weeklyFull: "Sunday 3am",
    hourlyIncremental: "Mon-Sat 10am-10pm",
    dailyIncremental: "Mon-Sat 3am",
  });
}

/**
 * Stops all backup scheduler jobs.
 */
export function stopBackupScheduler(): void {
  if (weeklyFullCron) {
    weeklyFullCron.stop();
    weeklyFullCron = null;
  }
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
  strategy: string;
  schedules: {
    weeklyFull: string | null;
    hourlyIncremental: string | null;
    dailyIncremental: string | null;
  };
} {
  return {
    enabled: weeklyFullCron !== null,
    strategy: "hybrid",
    schedules: {
      weeklyFull: weeklyFullCron ? "Sunday 3am" : null,
      hourlyIncremental: businessHoursCron ? "Mon-Sat 10am-10pm" : null,
      dailyIncremental: offHoursCron ? "Mon-Sat 3am" : null,
    },
  };
}

/**
 * Manually trigger an incremental export.
 */
export async function triggerIncrementalExport(): Promise<{ success: boolean; message: string }> {
  try {
    await exportIncrementalChanges();
    return { success: true, message: "Incremental export completed" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

/**
 * Manually trigger a full backup.
 */
export async function triggerFullBackup(): Promise<{ success: boolean; message: string }> {
  try {
    await runFullBackup();
    return { success: true, message: "Full backup completed" };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}
