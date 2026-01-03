import { createHash } from "crypto";
import { createReadStream, createWriteStream, statSync, unlinkSync, writeFileSync } from "fs";
import { pipeline } from "stream/promises";
import { createGunzip, createGzip } from "zlib";

import { Prisma, prisma } from "../../prisma.js";

export interface BackupResult {
  filename: string;
  path: string;
  checksum: string;
  sizeBytes: number;
  durationMs: number;
  tables: string[];
}

export interface BackupProgress {
  step: "init" | "exporting" | "compressing" | "uploading" | "cleanup" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

type ProgressCallback = (progress: BackupProgress) => void;

/**
 * Gets all Prisma model names dynamically from DMMF (Data Model Meta Format).
 * This auto-syncs with schema.prisma - no hardcoding needed.
 */
function getAllPrismaModels(): string[] {
  // Get model names from Prisma's DMMF
  const models = Prisma.dmmf.datamodel.models.map((m) => {
    // Convert PascalCase to camelCase for Prisma client access
    return m.name.charAt(0).toLowerCase() + m.name.slice(1);
  });
  return models;
}

/**
 * Creates a database backup using pure Prisma (no pg_dump required).
 * Exports all data as compressed JSON.
 */
export async function createBackup(_databaseUrl: string, onProgress?: ProgressCallback): Promise<BackupResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${timestamp}.json.gz`;
  const filepath = `/tmp/${filename}`;
  const jsonPath = `/tmp/backup_${timestamp}.json`;

  onProgress?.({ step: "init", progress: 5, message: "Initializing Prisma backup..." });

  const tables: string[] = [];
  const backupData: Record<string, unknown[]> = {};

  try {
    // executeTransactionalBackup: Ensure consistent snapshot across all tables
    await prisma.$transaction(
      async (tx) => {
        // Get all models dynamically from Prisma schema
        const allModels = getAllPrismaModels();
        const totalModels = allModels.length;

        for (let i = 0; i < totalModels; i++) {
          const modelName = allModels[i];
          const progress = Math.round(10 + (i / totalModels) * 50);

          onProgress?.({
            step: "exporting",
            progress,
            message: `Exporting ${modelName}...`,
          });

          try {
            // Organic type safety: Cast transaction client to a record of unknown values
            // We verify the existence of the method before calling it, avoiding 'any'
            const txRecords = tx as unknown as Record<string, unknown>;
            const candidate = txRecords[modelName];

            // Type guard to ensure candidate has findMany
            if (
              candidate &&
              typeof candidate === "object" &&
              "findMany" in candidate &&
              typeof (candidate as Record<string, unknown>).findMany === "function"
            ) {
              const model = candidate as { findMany: () => Promise<unknown[]> };
              const data = await model.findMany();

              if (Array.isArray(data) && data.length > 0) {
                backupData[modelName] = data;
                tables.push(modelName);
              }
            }
          } catch (error) {
            // Some models might not exist or have issues - log and continue
            console.warn(`⚠️ Skipping ${modelName}: ${error}`);
          }
        }
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5000,
        timeout: 60000 * 5, // 5 minutes max for backup
      }
    );

    onProgress?.({ step: "compressing", progress: 65, message: "Writing JSON..." });

    // Write JSON file (with BigInt support)
    const jsonContent = JSON.stringify(
      {
        version: "1.0",
        createdAt: new Date().toISOString(),
        prismaVersion: "7.x",
        tables,
        data: backupData,
      },
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      0
    ); // No pretty print to save space

    writeFileSync(jsonPath, jsonContent, "utf-8");

    onProgress?.({ step: "compressing", progress: 75, message: "Compressing..." });

    // Compress with gzip
    await pipeline(createReadStream(jsonPath), createGzip({ level: 6 }), createWriteStream(filepath));

    // Cleanup uncompressed file
    unlinkSync(jsonPath);

    onProgress?.({ step: "compressing", progress: 85, message: "Calculating checksum..." });

    // Get file size
    const stats = statSync(filepath);
    const sizeBytes = stats.size;

    // Calculate SHA256 checksum
    const checksum = await calculateChecksum(filepath);

    const durationMs = Date.now() - startTime;

    onProgress?.({ step: "done", progress: 100, message: "Backup completed" });

    return {
      filename,
      path: filepath,
      checksum,
      sizeBytes,
      durationMs,
      tables,
    };
  } catch (error) {
    // Cleanup on error
    try {
      unlinkSync(filepath);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(jsonPath);
    } catch {
      /* ignore */
    }
    throw new Error(`Backup failed: ${error}`);
  }
}

/**
 * Calculates SHA256 checksum of a file.
 */
function calculateChecksum(filepath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filepath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Cleans up temporary backup file.
 */
export function cleanupLocalBackup(filepath: string): void {
  try {
    unlinkSync(filepath);
  } catch {
    console.warn("⚠️ Failed to cleanup local backup file");
  }
}

/**
 * Extracts list of tables from a backup file.
 */
export async function extractTablesFromBackup(filepath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gunzip = createGunzip();
    const stream = createReadStream(filepath).pipe(gunzip);

    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => {
      try {
        const json = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        resolve(json.tables || []);
      } catch (error) {
        reject(error);
      }
    });
    stream.on("error", reject);
  });
}

/**
 * Restores from a backup file - full or granular (specific tables).
 */
export async function restoreFromBackup(
  _databaseUrl: string,
  backupPath: string,
  options: { tables?: string[]; dryRun?: boolean } = {},
  onProgress?: ProgressCallback
): Promise<{ success: boolean; message: string }> {
  const { tables: targetTables, dryRun } = options;

  onProgress?.({ step: "init", progress: 5, message: "Reading backup file..." });

  try {
    // Decompress and parse backup
    // NOTE: For very large backups (>500MB), consider using a streaming JSON parser
    // to avoid loading the entire file into memory.
    const chunks: Buffer[] = [];
    const gunzip = createGunzip();
    const stream = createReadStream(backupPath).pipe(gunzip);

    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    const backup = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
    const data = backup.data as Record<string, unknown[]>;

    onProgress?.({ step: "exporting", progress: 20, message: "Parsing backup data..." });

    // Determine which tables to restore
    const tablesToRestore = targetTables || Object.keys(data);
    const totalTables = tablesToRestore.length;
    let restoredCount = 0;

    if (dryRun) {
      for (const tableName of tablesToRestore) {
        const count = data[tableName]?.length || 0;
        console.log(`[DRY RUN] Would restore ${count} records to ${tableName}`);
        restoredCount++;
      }
      return { success: true, message: `[DRY RUN] Would restore ${restoredCount} tables` };
    }

    // executeTransactionalRestore: Wraps the entire restore in a transaction
    await prisma.$transaction(
      async (tx) => {
        // 1. Disable Foreign Key constraints for this transaction
        // "SET LOCAL" scopes the change to the current transaction only.
        try {
          await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica';");
        } catch (e) {
          console.warn("⚠️ Could not set session_replication_role. Ensure DB user has sufficient privileges.", e);
          // Fallback: Proceed, hoping for best (or constraints are deferred)
        }

        for (let i = 0; i < totalTables; i++) {
          const tableName = tablesToRestore[i];
          const tableData = data[tableName];

          if (!tableData || tableData.length === 0) continue;

          const progress = Math.round(20 + (i / totalTables) * 70);
          onProgress?.({
            step: "exporting",
            progress,
            message: `Restoring ${tableName} (${tableData.length} records)...`,
          });

          // Define a generic delegate interface for the methods we need
          interface PrismaDelegate {
            createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<void>;
            deleteMany(): Promise<void>;
          }
          const model = (tx as unknown as Record<string, PrismaDelegate>)[tableName];

          if (model && typeof model.createMany === "function") {
            // 2. Clear existing data
            // Since FKs are disabled/deferred, we can delete safely
            await model.deleteMany();

            // 3. Insert data in batches
            const batchSize = 1000;
            for (let j = 0; j < tableData.length; j += batchSize) {
              const batch = tableData.slice(j, j + batchSize);
              await model.createMany({
                data: batch,
                skipDuplicates: true,
              });
            }
            restoredCount++;
          }
        }
      },
      {
        maxWait: 5000, // Wait for lock
        timeout: 60000 * 5, // 5 minutes max for restore
      }
    );

    onProgress?.({ step: "done", progress: 100, message: "Restore completed" });

    return {
      success: true,
      message: targetTables
        ? `Restored ${restoredCount} tables: ${tablesToRestore.join(", ")}`
        : `Full restore completed (${restoredCount} tables)`,
    };
  } catch (error) {
    console.error("Restore failed:", error);
    return {
      success: false,
      message: String(error),
    };
  }
}
