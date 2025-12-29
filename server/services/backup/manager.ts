/**
 * Backup Manager - Orchestrates backup and restore operations
 *
 * Manages job state, progress broadcasting via SSE, and history.
 */

import { createBackup, cleanupLocalBackup, formatBytes, restoreFromBackup } from "./backup.js";
import { uploadToDrive, cleanupOldBackups, listBackups, downloadFromDrive, getBackupInfo, DriveFile } from "./drive.js";
import { unlinkSync } from "fs";
import { isGoogleConfigured } from "../../lib/google-core.js";

// Types
export interface BackupJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  type: "full" | "scheduled";
  startedAt: Date;
  completedAt?: Date;
  progress: number;
  currentStep: string;
  result?: {
    filename: string;
    sizeBytes: number;
    durationMs: number;
    driveFileId: string;
    tables: string[];
  };
  error?: string;
}

export interface RestoreJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  backupFileId: string;
  tables?: string[];
  startedAt: Date;
  completedAt?: Date;
  progress: number;
  currentStep: string;
  error?: string;
}

// ==================== LOG COLLECTION ====================

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "info" | "warn" | "error" | "success";
  message: string;
  context?: Record<string, unknown>;
}

// Ring buffer for logs (in-memory, last 500 entries)
const logs: LogEntry[] = [];
const MAX_LOGS = 500;

function addLog(level: LogEntry["level"], message: string, context?: Record<string, unknown>) {
  const entry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date(),
    level,
    message,
    context,
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) {
    logs.pop();
  }
  // Broadcast log to SSE clients
  broadcastLog(entry);
  return entry;
}

export function getLogs(limit = 100): LogEntry[] {
  return logs.slice(0, limit);
}

export function clearLogs(): void {
  logs.length = 0;
}

// ==================== IN-MEMORY STATE ====================

let currentBackupJob: BackupJob | null = null;
let currentRestoreJob: RestoreJob | null = null;
const jobHistory: (BackupJob | RestoreJob)[] = [];
const MAX_HISTORY = 50;

// SSE clients for real-time updates
const sseClients: Set<(data: string) => void> = new Set();

function broadcastProgress(type: "backup" | "restore", job: BackupJob | RestoreJob) {
  const message = JSON.stringify({ type, job });
  sseClients.forEach((send) => send(message));
}

function broadcastLog(entry: LogEntry) {
  const message = JSON.stringify({ type: "log", entry });
  sseClients.forEach((send) => send(message));
}

export function subscribeToProgress(sendEvent: (data: string) => void) {
  sseClients.add(sendEvent);
  return () => sseClients.delete(sendEvent);
}

// ==================== BACKUP CONFIG ====================

interface BackupConfig {
  databaseUrl: string;
  retentionDays: number;
}

function getConfig(): BackupConfig {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for backups");
  }

  if (!isGoogleConfigured()) {
    throw new Error(
      "Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  return {
    databaseUrl,
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || "7", 10),
  };
}

// ==================== BACKUP OPERATIONS ====================

export async function startBackup(): Promise<BackupJob> {
  if (currentBackupJob?.status === "running") {
    throw new Error("Backup already in progress");
  }

  const config = getConfig();
  const jobId = `backup_${Date.now()}`;

  currentBackupJob = {
    id: jobId,
    status: "running",
    type: "full",
    startedAt: new Date(),
    progress: 0,
    currentStep: "Initializing...",
  };

  broadcastProgress("backup", currentBackupJob);

  // Run async
  runBackupJob(config, currentBackupJob);

  return currentBackupJob;
}

async function runBackupJob(config: BackupConfig, job: BackupJob) {
  const startTime = Date.now();

  try {
    // Step 1: Create local backup
    addLog("info", "Starting pg_dump...");
    job.currentStep = "Running pg_dump...";
    job.progress = 10;
    broadcastProgress("backup", job);

    const backup = await createBackup(config.databaseUrl, (p) => {
      job.progress = Math.min(10 + p.progress * 0.5, 60);
      job.currentStep = p.message;
      broadcastProgress("backup", job);
    });

    // Step 2: Upload to Drive
    addLog("info", `pg_dump completed: ${formatBytes(backup.sizeBytes)}`, { tables: backup.tables.length });
    job.currentStep = "Uploading to Google Drive...";
    job.progress = 65;
    broadcastProgress("backup", job);

    const upload = await uploadToDrive(backup.path, backup.filename);
    addLog("info", "Uploaded to Google Drive", { fileId: upload.fileId });

    // Step 3: Cleanup local
    job.currentStep = "Cleaning up local files...";
    job.progress = 85;
    broadcastProgress("backup", job);
    cleanupLocalBackup(backup.path);

    // Step 4: Cleanup old backups
    job.currentStep = "Removing old backups...";
    job.progress = 90;
    broadcastProgress("backup", job);

    await cleanupOldBackups(config.retentionDays);

    // Complete
    job.status = "completed";
    job.completedAt = new Date();
    job.progress = 100;
    job.currentStep = "Completed";
    job.result = {
      filename: backup.filename,
      sizeBytes: backup.sizeBytes,
      durationMs: Date.now() - startTime,
      driveFileId: upload.fileId,
      tables: backup.tables,
    };

    addLog("success", `Backup completed: ${formatBytes(backup.sizeBytes)} in ${job.result.durationMs}ms`, {
      filename: backup.filename,
      sizeBytes: backup.sizeBytes,
      durationMs: job.result.durationMs,
      tablesCount: backup.tables.length,
    });
    console.log(`✅ Backup completed: ${formatBytes(backup.sizeBytes)} in ${job.result.durationMs}ms`);
  } catch (error) {
    job.status = "failed";
    job.completedAt = new Date();
    job.currentStep = "Failed";
    job.error = String(error);

    addLog("error", `Backup failed: ${String(error)}`);
    console.error("❌ Backup failed:", error);
  }

  broadcastProgress("backup", job);
  addToHistory(job);
  currentBackupJob = null;
}

// ==================== RESTORE OPERATIONS ====================

export async function startRestore(backupFileId: string, tables?: string[]): Promise<RestoreJob> {
  if (currentRestoreJob?.status === "running") {
    throw new Error("Restore already in progress");
  }

  const config = getConfig();
  const jobId = `restore_${Date.now()}`;

  currentRestoreJob = {
    id: jobId,
    status: "running",
    backupFileId,
    tables,
    startedAt: new Date(),
    progress: 0,
    currentStep: "Initializing...",
  };

  broadcastProgress("restore", currentRestoreJob);

  // Run async
  runRestoreJob(config, currentRestoreJob);

  return currentRestoreJob;
}

async function runRestoreJob(config: BackupConfig, job: RestoreJob) {
  const localPath = `/tmp/restore_${Date.now()}.dump`;

  try {
    // Step 1: Download from Drive
    job.currentStep = "Downloading backup from Drive...";
    job.progress = 10;
    broadcastProgress("restore", job);

    await downloadFromDrive(job.backupFileId, localPath);

    // Step 2: Restore
    job.currentStep = job.tables ? `Restoring tables: ${job.tables.join(", ")}...` : "Restoring full database...";
    job.progress = 50;
    broadcastProgress("restore", job);

    const result = await restoreFromBackup(config.databaseUrl, localPath, {
      tables: job.tables,
    });

    if (!result.success) {
      throw new Error(result.message);
    }

    // Step 3: Cleanup
    job.currentStep = "Cleaning up...";
    job.progress = 90;
    broadcastProgress("restore", job);
    try {
      unlinkSync(localPath);
    } catch {
      // Ignore cleanup errors
    }

    // Complete
    job.status = "completed";
    job.completedAt = new Date();
    job.progress = 100;
    job.currentStep = "Completed";

    console.log(`✅ Restore completed: ${job.tables ? job.tables.join(", ") : "full database"}`);
  } catch (error) {
    job.status = "failed";
    job.completedAt = new Date();
    job.currentStep = "Failed";
    job.error = String(error);

    console.error("❌ Restore failed:", error);

    try {
      unlinkSync(localPath);
    } catch {
      // Ignore cleanup errors
    }
  }

  broadcastProgress("restore", job);
  addToHistory(job);
  currentRestoreJob = null;
}

// ==================== QUERIES ====================

export function getCurrentJobs() {
  return {
    backup: currentBackupJob,
    restore: currentRestoreJob,
  };
}

export function getJobHistory() {
  return jobHistory;
}

export async function getBackups(): Promise<DriveFile[]> {
  getConfig(); // Validates configuration
  return listBackups();
}

export async function getBackupDetails(fileId: string): Promise<DriveFile | null> {
  getConfig(); // Validates configuration
  return getBackupInfo(fileId);
}

export async function getBackupTables(fileId: string): Promise<string[]> {
  getConfig(); // Validates configuration
  const localPath = `/tmp/inspect_${Date.now()}.dump`;

  try {
    await downloadFromDrive(fileId, localPath);

    // Use pg_restore to list contents
    const { execSync } = await import("child_process");
    const output = execSync(`pg_restore -l "${localPath}" 2>/dev/null | grep "TABLE " | awk '{print $6}'`, {
      encoding: "utf-8",
    });

    unlinkSync(localPath);

    return output
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch (error) {
    try {
      unlinkSync(localPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

// ==================== HELPERS ====================

function addToHistory(job: BackupJob | RestoreJob) {
  jobHistory.unshift(job);
  if (jobHistory.length > MAX_HISTORY) {
    jobHistory.pop();
  }
}
