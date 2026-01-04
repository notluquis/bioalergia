import { createHash } from "crypto";
import {
  createReadStream,
  createWriteStream,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { pipeline } from "stream/promises";
import { createGunzip, createGzip } from "zlib";

import { db, schema } from "@finanzas/db";

export interface BackupResult {
  filename: string;
  path: string;
  checksum: string;
  sizeBytes: number;
  durationMs: number;
  tables: string[];
}

export interface BackupProgress {
  step:
    | "init"
    | "exporting"
    | "compressing"
    | "uploading"
    | "cleanup"
    | "done"
    | "error";
  progress: number; // 0-100
  message: string;
}

type ProgressCallback = (progress: BackupProgress) => void;

/**
 * Gets model names statically or from schema.
 * ZenStack doesn't expose DMMF directly like Prisma via the client,
 * so we maintain a list of critical models or try to infer.
 * For now, using a static list of known models is safer and cleaner for this migration.
 */
function getAllModelNames(): string[] {
  // Ordered by dependency if possible, though not strictly required for JSON export
  // Use static list as fallback logic is safer than suppressed types
  return Object.keys(schema.models || {}).length > 0
    ? Object.keys((schema as any).models)
    : [
        "User",
        "Person",
        "Role",
        "Permission",
        "RolePermission",
        "UserRoleAssignment",
        "Employee",
        "Counterpart",
        "CounterpartAccount",
        "Service",
        "Transaction",
        "DailyBalance",
        "DailyProductionBalance",
        "Loan",
        "LoanSchedule",
        "InventoryItem",
        "InventoryCategory",
        "InventoryMovement",
        "SupplyRequest",
        "PushSubscription",
        "Setting",
        "AuditLog",
      ];
}

/**
 * Creates a database backup.
 */
export async function createBackup(
  onProgress?: ProgressCallback
): Promise<BackupResult> {
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
  const backupData: Record<string, unknown[]> = {};

  // Scope variables for cleanup in catch block
  let success = false;

  try {
    // Perform backup in a transaction for consistency
    await db.$transaction(async (tx) => {
      const allModels = getAllModelNames();
      const totalModels = allModels.length;

      for (let i = 0; i < totalModels; i++) {
        const modelName = allModels[i];
        const camelModelName =
          modelName.charAt(0).toLowerCase() + modelName.slice(1);
        const progress = Math.round(10 + (i / totalModels) * 50);

        onProgress?.({
          step: "exporting",
          progress,
          message: `Exporting ${modelName}...`,
        });

        try {
          const txRecord = tx as Record<string, any>;
          const modelDelegate = txRecord[camelModelName];
          if (modelDelegate && typeof modelDelegate.findMany === "function") {
            const data = await modelDelegate.findMany();
            if (Array.isArray(data) && data.length > 0) {
              backupData[modelName] = data;
              tables.push(modelName);
            }
          } else {
            // Try PascalCase if camelCase failed (ZenStack/Kysely nuances)
            const pascalDelegate = txRecord[modelName];
            if (
              pascalDelegate &&
              typeof pascalDelegate.findMany === "function"
            ) {
              const data = await pascalDelegate.findMany();
              if (Array.isArray(data) && data.length > 0) {
                backupData[modelName] = data;
                tables.push(modelName);
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ Skipping ${modelName}: ${error}`);
        }
      }
    }, {});

    onProgress?.({
      step: "compressing",
      progress: 65,
      message: "Writing JSON...",
    });

    const jsonContent = JSON.stringify(
      {
        version: "1.0",
        createdAt: new Date().toISOString(),
        engine: "ZenStack/Kysely",
        tables,
        data: backupData,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      0
    );

    writeFileSync(jsonPath, jsonContent, "utf-8");

    onProgress?.({
      step: "compressing",
      progress: 75,
      message: "Compressing...",
    });

    await pipeline(
      createReadStream(jsonPath),
      createGzip({ level: 6 }),
      createWriteStream(filepath)
    );

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
    success = true;

    return {
      filename,
      path: filepath,
      checksum,
      sizeBytes,
      durationMs,
      tables,
    };
  } catch (error) {
    // Cleanup
    try {
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
const jobs: Record<string, any> = {};
const history: any[] = [];
const logs: any[] = [];

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
    jobs[jobId].status = p.step === "done" ? "completed" : "running";
    if (p.message) logs.push({ timestamp: new Date(), message: p.message });
  })
    .then((res) => {
      jobs[jobId].status = "completed";
      jobs[jobId].result = res;
      history.push(jobs[jobId]);
      delete jobs[jobId];
    })
    .catch((err) => {
      jobs[jobId].status = "failed";
      jobs[jobId].error = err.message;
      history.push(jobs[jobId]);
      delete jobs[jobId];
    });

  return jobs[jobId];
}
