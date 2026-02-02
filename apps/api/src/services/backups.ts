import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { db } from "@finanzas/db";

import { uploadToDrive } from "./drive";

export interface BackupResult {
  filename: string;
  path: string;
  checksum: string;
  sizeBytes: number;
  durationMs: number;
  tables: string[];
  stats: Record<string, { count: number; hash: string }>;
}

export interface BackupProgress {
  step: "init" | "exporting" | "compressing" | "uploading" | "cleanup" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

type ProgressCallback = (progress: BackupProgress) => void;

/**
 * Gets model names statically or from schema.
 * ZenStack doesn't expose DMMF directly via the client,
 * so we maintain a list of critical models or try to infer.
 * For now, using a static list of known models is safer and cleaner.
 */
function getAllModelNames(): string[] {
  // All models from schema.zmodel in dependency order
  return [
    "Person",
    "User",
    "Passkey",
    "Role",
    "Permission",
    "RolePermission",
    "UserRoleAssignment",
    "UserPermissionVersion",
    "Employee",
    "EmployeeTimesheet",
    "Counterpart",
    "CounterpartAccount",
    "Transaction",
    "DailyBalance",
    "Service",
    "Loan",
    "LoanSchedule",

    "Setting",
    "PushSubscription",
    "Calendar",
    "CalendarWatchChannel",
    "Event",
    "CalendarSyncLog",
    "SyncLog",
    "BackupLog",
    "InventoryCategory",
    "InventoryItem",
    "InventoryMovement",
    "DailyProductionBalance",
    "SupplyRequest",
    "CommonSupply",
    "SettlementTransaction",
    "ReleaseTransaction",
    "CalendarSyncLog",
  ];
}

/**
 * Creates a database backup.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy backup logic
export async function createBackup(onProgress?: ProgressCallback): Promise<BackupResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${timestamp}.json.gz`;
  const filepath = `/tmp/${filename}`;
  const jsonPath = `/tmp/backup_${timestamp}.json`;

  onProgress?.({
    step: "init",
    progress: 5,
    message: "Initializing backup...",
  });

  const tables: string[] = [];
  const tableStats: Record<string, { count: number; hash: string }> = {};

  // Scope variables for cleanup in catch block
  let _success = false;
  let writeStream: ReturnType<typeof createWriteStream> | undefined;

  try {
    const allModels = getAllModelNames();
    const totalModels = allModels.length;

    // Open Write Stream
    writeStream = createWriteStream(jsonPath, { encoding: "utf8" });

    // Write Header
    const header = JSON.stringify({
      version: "1.0",
      createdAt: new Date().toISOString(),
      engine: "ZenStack/Kysely",
      tables: allModels, // We'll list all inspected models
    });

    // We manually slice the JSON to insert "data" key
    // Header: {"version":"1.0",...,"tables":[...]}
    // Target: {"version":"1.0",...,"tables":[...], "data": { ... }}
    writeStream.write(`${header.slice(0, -1)},"data":{`);

    for (let i = 0; i < totalModels; i++) {
      const modelName = allModels[i];
      const camelModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
      const progress = Math.round(10 + (i / totalModels) * 50);

      onProgress?.({
        step: "exporting",
        progress,
        message: `Exporting ${modelName}...`,
      });

      // Write Model Key
      if (i > 0) writeStream.write(",");
      writeStream.write(`"${modelName}":`);

      try {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic db access
        const dbRecord = db as Record<string, any>;
        const modelDelegate = dbRecord[camelModelName];

        if (modelDelegate && typeof modelDelegate.findMany === "function") {
          const modelHash = createHash("sha256");
          let modelCount = 0;
          let hasWrittenRow = false;

          writeStream.write("[");

          // PAGINATION LOOP
          const BATCH_SIZE = 1000;
          let skip = 0;

          while (true) {
            const batch: unknown[] = await modelDelegate.findMany({
              take: BATCH_SIZE,
              skip: skip,
            });

            if (!Array.isArray(batch) || batch.length === 0) break;

            for (const row of batch) {
              const jsonRow = JSON.stringify(row, (_, value) =>
                typeof value === "bigint" ? value.toString() : value,
              );

              if (hasWrittenRow) writeStream.write(",");
              writeStream.write(jsonRow);

              modelHash.update(jsonRow);
              modelCount++;
              hasWrittenRow = true;
            }

            skip += batch.length;
            if (batch.length < BATCH_SIZE) break;

            // Optional: Give event loop a breather
            await new Promise((resolve) => setTimeout(resolve, 0));
          }

          writeStream.write("]");

          if (modelCount > 0) {
            tables.push(modelName);
            tableStats[modelName] = {
              count: modelCount,
              hash: modelHash.digest("hex"),
            };
          } else {
            // Empty table, hash of empty string or null?
            // Original logic only added stats if length > 0.
            // But we wrote [] so it exists in JSON.
          }
        } else {
          writeStream.write("[]"); // Empty array for missing delegate
          console.warn(`⚠️ Model delegate not found for ${modelName} (tried ${camelModelName})`);
        }
      } catch (error) {
        writeStream.write("[]"); // Fail safe
        console.warn(`⚠️ Skipping ${modelName}: ${error}`);
      }
    }

    // Close JSON
    writeStream.write("}}");
    writeStream.end();

    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      if (!writeStream) return resolve();
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    const jsonStats = statSync(jsonPath);
    console.log(`[Backup] JSON file generated at ${jsonPath}, size: ${jsonStats.size} bytes`);

    onProgress?.({
      step: "compressing",
      progress: 75,
      message: `Compressing (${(jsonStats.size / 1024 / 1024).toFixed(2)} MB)...`,
    });

    try {
      console.log(`[Backup] Starting compression pipeline for ${jsonPath}`);
      const readStream = createReadStream(jsonPath);
      const outputWriteStream = createWriteStream(filepath);
      const gzip = createGzip({ level: 6 });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          readStream.destroy();
          gzip.destroy();
          outputWriteStream.destroy();
          reject(new Error("Compression timed out after 60 seconds"));
        }, 60000); // 60s timeout

        let bytesProcessed = 0;
        readStream.on("data", (chunk) => {
          bytesProcessed += chunk.length;
          // Log every ~5MB to avoid spam
          if (Math.random() > 0.95) {
            console.log(
              `[Backup] Compressing... processed ${(bytesProcessed / 1024 / 1024).toFixed(1)} MB`,
            );
          }
        });

        pipeline(readStream, gzip, outputWriteStream)
          .then(() => {
            clearTimeout(timeout);
            resolve();
          })
          .catch((err) => {
            clearTimeout(timeout);
            reject(err);
          });
      });
    } catch (pipelineError) {
      console.error("[Backup] Compression pipeline failed:", pipelineError);
      throw new Error(`Compression failed: ${pipelineError}`);
    }

    console.log(`[Backup] Compression completed: ${filepath}`);

    unlinkSync(jsonPath);

    onProgress?.({
      step: "compressing",
      progress: 85,
      message: "Calculating checksum...",
    });

    const checksum = await calculateChecksum(filepath);
    const durationMs = Date.now() - startTime;
    const stats = statSync(filepath);
    const sizeBytes = stats.size;

    onProgress?.({ step: "done", progress: 100, message: "Backup completed" });
    _success = true;

    return {
      filename,
      path: filepath,
      checksum,
      sizeBytes,
      durationMs,
      tables,
      stats: tableStats,
    };
  } catch (error) {
    // Cleanup
    try {
      if (writeStream && !writeStream.closed) writeStream.destroy();
      if (statSync(filepath)) unlinkSync(filepath);
    } catch {}
    try {
      if (statSync(jsonPath)) unlinkSync(jsonPath);
    } catch {}
    throw new Error(`Backup failed: ${error}`);
  }
}

function calculateChecksum(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filepath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

// Simple managers for jobs/history
interface BackupJob {
  id: string;
  type: string;
  status: "running" | "uploading" | "completed" | "failed";
  progress: number;
  currentStep?: string;
}

interface BackupLogEntry {
  timestamp: Date;
  message: string;
}

const jobs: Record<string, BackupJob> = {};
const history: BackupJob[] = [];
const logs: BackupLogEntry[] = [];

export function getLogs(limit: number) {
  return logs.slice(-limit);
}

export function getCurrentJobs() {
  return Object.values(jobs);
}

export function getJobHistory() {
  return history;
}

export function startBackup() {
  const jobId = `backup-${Date.now()}`;
  jobs[jobId] = { id: jobId, type: "backup", status: "running", progress: 0 };

  // Run async
  createBackup((p) => {
    jobs[jobId].progress = p.progress;
    jobs[jobId].status = p.step === "done" ? "uploading" : "running"; // Don't mark as done until upload finishes
    jobs[jobId].currentStep = p.message; // Expose granular step to UI
    if (p.message) logs.push({ timestamp: new Date(), message: p.message });
  })
    .then(async (res) => {
      // Deduplication Check
      try {
        const { listBackups } = await import("./drive");
        const existingBackups = await listBackups();
        const lastBackup = existingBackups[0];

        if (lastBackup && lastBackup.customChecksum === res.checksum) {
          console.log(`[Backup] Duplicate checksum detected (${res.checksum}). Skipping upload.`);

          jobs[jobId].status = "completed";
          jobs[jobId].progress = 100;
          jobs[jobId].currentStep = "No changes detected - Backup skipped";

          // We return a specialized result indicating duplication
          jobs[jobId].result = {
            ...res,
            skipped: true,
            message: "Backup identico al anterior (sin cambios)",
          };
          history.push(jobs[jobId]);

          try {
            unlinkSync(res.path);
          } catch {}

          // Delay cleanup
          setTimeout(() => {
            delete jobs[jobId];
          }, 5000);

          return; // EXIT EARLY
        }
      } catch (dedupeError) {
        console.warn("[Backup] Deduplication check failed, proceeding with upload:", dedupeError);
      }

      // Upload to Drive
      jobs[jobId].currentStep = "Uploading to Google Drive...";
      jobs[jobId].status = "uploading";

      try {
        const driveFile = await uploadToDrive(
          res.path,
          res.filename,
          res.tables,
          res.checksum,
          res.stats,
        );

        // Add Drive info to result
        const finalResult = {
          ...res,
          driveFileId: driveFile.fileId,
          webViewLink: driveFile.webViewLink,
        };

        jobs[jobId].status = "completed";
        jobs[jobId].progress = 100;
        jobs[jobId].currentStep = "Backup completed and uploaded";
        jobs[jobId].result = finalResult;
        history.push(jobs[jobId]);

        // Clean up local compressed file after successful upload
        try {
          unlinkSync(res.path);
        } catch (e) {
          console.warn(`Failed to cleanup local backup file: ${res.path}`, e);
        }
      } catch (uploadError) {
        console.error("Upload failed", uploadError);
        jobs[jobId].status = "failed";
        jobs[jobId].error =
          `Upload failed: ${uploadError instanceof Error ? uploadError.message : "Unknown error"}`;

        // Even if upload fails, we might want to keep the local file or log it?
        // For now, treat as failure.
      }

      // Delay cleanup to allow SSE to broadcast the state
      setTimeout(() => {
        delete jobs[jobId];
      }, 5000);
    })
    .catch((err) => {
      jobs[jobId].status = "failed";
      jobs[jobId].error = err.message;
      history.push(jobs[jobId]);
      delete jobs[jobId];
    });

  return jobs[jobId];
}

/**
 * Compares current database state with a backup.
 * Returns granular differences per table.
 */
export async function getBackupDiff(fileId: string) {
  const { getBackupStats } = await import("./drive");
  const backupStats = await getBackupStats(fileId);

  if (!backupStats) {
    throw new Error("Backup does not support granular comparison (legacy)");
  }

  const allModels = getAllModelNames();
  const diffs: Array<{
    table: string;
    status: "match" | "count_mismatch" | "content_mismatch" | "missing_local" | "missing_remote";
    localCount: number;
    remoteCount: number;
  }> = [];

  for (const model of allModels) {
    const remote = backupStats[model];
    // Cast strict type
    // biome-ignore lint/suspicious/noExplicitAny: dynamic db model access
    const modelDelegate = (db as any)[model];

    if (!modelDelegate || typeof modelDelegate.findMany !== "function") {
      continue;
    }

    const localCount = await modelDelegate.count();

    if (!remote) {
      if (localCount > 0) {
        diffs.push({
          table: model,
          status: "missing_remote",
          localCount,
          remoteCount: 0,
        });
      }
      continue;
    }

    if (localCount !== remote.count) {
      diffs.push({
        table: model,
        status: "count_mismatch",
        localCount,
        remoteCount: remote.count,
      });
      continue;
    }

    // Counts match, verify content hash (expensive)
    // We only do this for small tables or if requested?
    // For now, let's do it regardless but warn.
    const data = await modelDelegate.findMany();
    const jsonString = JSON.stringify(data, (_, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    const localHash = createHash("sha256").update(jsonString).digest("hex");

    if (localHash !== remote.hash) {
      diffs.push({
        table: model,
        status: "content_mismatch",
        localCount,
        remoteCount: remote.count,
      });
    } else {
      diffs.push({
        table: model,
        status: "match",
        localCount,
        remoteCount: remote.count,
      });
    }
  }

  return diffs;
}
