import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, statSync, unlinkSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { db, schema } from "@finanzas/db";

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
type BackupTableStats = Record<string, { count: number; hash: string }>;

const getDelegateName = (modelName: string) =>
  modelName.charAt(0).toLowerCase() + modelName.slice(1);

type ModelDelegate = {
  findMany: (args?: Record<string, unknown>) => Promise<unknown[]>;
  count: (args?: Record<string, unknown>) => Promise<number>;
};

const getModelDelegate = (modelName: string) => {
  const dbRecord = db as unknown as Record<string, ModelDelegate | undefined>;
  return dbRecord[getDelegateName(modelName)];
};

function getAllModelNames(): string[] {
  // Always use all runtime schema models to avoid stale manual lists.
  return Object.keys(schema.models).sort((a, b) => a.localeCompare(b));
}

const safeUnlink = (path: string) => {
  try {
    unlinkSync(path);
  } catch {
    // Intentionally ignore cleanup errors
  }
};

const emitProgress = (
  onProgress: ProgressCallback | undefined,
  step: BackupProgress["step"],
  progress: number,
  message: string,
) => {
  onProgress?.({ step, progress, message });
};

const stringifyRow = (row: unknown) =>
  JSON.stringify(row, (_, value) => (typeof value === "bigint" ? value.toString() : value));

async function writeModelData(
  modelName: string,
  modelDelegate: ModelDelegate | undefined,
  writeStream: ReturnType<typeof createWriteStream>,
  tables: string[],
  tableStats: BackupTableStats,
) {
  if (!modelDelegate || typeof modelDelegate.findMany !== "function") {
    writeStream.write("[]");
    console.warn(
      `⚠️ Model delegate not found for ${modelName} (tried ${getDelegateName(modelName)})`,
    );
    return;
  }

  const modelHash = createHash("sha256");
  let modelCount = 0;
  let hasWrittenRow = false;

  writeStream.write("[");
  const batchSize = 1000;
  let skip = 0;

  for (;;) {
    const batch: unknown[] = await modelDelegate.findMany({ take: batchSize, skip });
    if (batch.length === 0) {
      break;
    }

    for (const row of batch) {
      const jsonRow = stringifyRow(row);
      if (hasWrittenRow) {
        writeStream.write(",");
      }
      writeStream.write(jsonRow);
      modelHash.update(jsonRow);
      modelCount++;
      hasWrittenRow = true;
    }

    skip += batch.length;
    if (batch.length < batchSize) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  writeStream.write("]");

  if (modelCount > 0) {
    tables.push(modelName);
    tableStats[modelName] = {
      count: modelCount,
      hash: modelHash.digest("hex"),
    };
  }
}

async function writeBackupJsonData(params: {
  allModels: string[];
  jsonPath: string;
  onProgress?: ProgressCallback;
  tableStats: BackupTableStats;
  tables: string[];
}) {
  const writeStream = createWriteStream(params.jsonPath, { encoding: "utf8" });
  const header = JSON.stringify({
    version: "1.0",
    createdAt: new Date().toISOString(),
    engine: "ZenStack/Kysely",
    tables: params.allModels,
  });
  writeStream.write(`${header.slice(0, -1)},"data":{`);

  for (let i = 0; i < params.allModels.length; i++) {
    const modelName = params.allModels[i];
    const progress = Math.round(10 + (i / params.allModels.length) * 50);
    emitProgress(params.onProgress, "exporting", progress, `Exporting ${modelName}...`);

    if (i > 0) {
      writeStream.write(",");
    }
    writeStream.write(`"${modelName}":`);

    try {
      const modelDelegate = getModelDelegate(modelName);
      await writeModelData(modelName, modelDelegate, writeStream, params.tables, params.tableStats);
    } catch (error) {
      writeStream.write("[]");
      console.warn(`⚠️ Skipping ${modelName}: ${error}`);
    }
  }

  writeStream.write("}}");
  writeStream.end();

  await new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
}

async function compressBackupJson(jsonPath: string, filepath: string) {
  const readStream = createReadStream(jsonPath);
  const outputWriteStream = createWriteStream(filepath);
  const gzip = createGzip({ level: 6 });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      readStream.destroy();
      gzip.destroy();
      outputWriteStream.destroy();
      reject(new Error("Compression timed out after 60 seconds"));
    }, 60000);

    let bytesProcessed = 0;
    readStream.on("data", (chunk) => {
      bytesProcessed += chunk.length;
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
}

const cleanupBackupFiles = (paths: { filepath: string; jsonPath: string }) => {
  safeUnlink(paths.filepath);
  safeUnlink(paths.jsonPath);
};

/**
 * Creates a database backup.
 */
export async function createBackup(onProgress?: ProgressCallback): Promise<BackupResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${timestamp}.json.gz`;
  const filepath = `/tmp/${filename}`;
  const jsonPath = `/tmp/backup_${timestamp}.json`;

  emitProgress(onProgress, "init", 5, "Initializing backup...");

  const tables: string[] = [];
  const tableStats: BackupTableStats = {};

  try {
    const allModels = getAllModelNames();
    await writeBackupJsonData({
      allModels,
      jsonPath,
      onProgress,
      tableStats,
      tables,
    });

    const jsonStats = statSync(jsonPath);
    console.log(`[Backup] JSON file generated at ${jsonPath}, size: ${jsonStats.size} bytes`);

    emitProgress(
      onProgress,
      "compressing",
      75,
      `Compressing (${(jsonStats.size / 1024 / 1024).toFixed(2)} MB)...`,
    );

    try {
      console.log(`[Backup] Starting compression pipeline for ${jsonPath}`);
      await compressBackupJson(jsonPath, filepath);
    } catch (pipelineError) {
      console.error("[Backup] Compression pipeline failed:", pipelineError);
      throw new Error(`Compression failed: ${pipelineError}`);
    }

    console.log(`[Backup] Compression completed: ${filepath}`);

    safeUnlink(jsonPath);

    emitProgress(onProgress, "compressing", 85, "Calculating checksum...");

    const checksum = await calculateChecksum(filepath);
    const durationMs = Date.now() - startTime;
    const stats = statSync(filepath);
    const sizeBytes = stats.size;

    emitProgress(onProgress, "done", 100, "Backup completed");

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
    cleanupBackupFiles({ filepath, jsonPath });
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
  type: "full" | "scheduled";
  status: "running" | "uploading" | "completed" | "failed" | "pending";
  progress: number;
  currentStep: string;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  result?: Record<string, unknown>;
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
  const now = new Date();
  jobs[jobId] = {
    id: jobId,
    type: "full",
    status: "running",
    progress: 0,
    currentStep: "Initializing...",
    startedAt: now,
  };

  // Run async
  createBackup((p) => {
    jobs[jobId].progress = p.progress;
    jobs[jobId].status = p.step === "done" ? "uploading" : "running"; // Don't mark as done until upload finishes
    jobs[jobId].currentStep = p.message; // Expose granular step to UI
    if (p.message) {
      logs.push({ timestamp: new Date(), message: p.message });
    }
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
          } catch (error) {
            console.warn("[Backup] Cleanup failed:", error);
          }

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
    const modelDelegate = getModelDelegate(model);

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
    const data = await modelDelegate.findMany({});
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
