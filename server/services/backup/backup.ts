import { execSync } from "child_process";
import { createReadStream, statSync, unlinkSync } from "fs";
import { createHash } from "crypto";

export interface BackupResult {
  filename: string;
  path: string;
  checksum: string;
  sizeBytes: number;
  durationMs: number;
  tables: string[];
}

export interface BackupProgress {
  step: "init" | "dumping" | "uploading" | "cleanup" | "done" | "error";
  progress: number; // 0-100
  message: string;
}

type ProgressCallback = (progress: BackupProgress) => void;

/**
 * Creates a PostgreSQL backup using pg_dump with custom format.
 * Custom format (-Fc) allows parallel restore and selective table restore.
 */
export async function createBackup(databaseUrl: string, onProgress?: ProgressCallback): Promise<BackupResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup_${timestamp}.dump`;
  const filepath = `/tmp/${filename}`;

  onProgress?.({ step: "init", progress: 5, message: "Initializing backup..." });

  try {
    // pg_dump with custom format
    // -Fc: Custom format (compressed, supports parallel restore)
    // -Z4: Compression level 4 (good balance of speed/size)
    onProgress?.({ step: "dumping", progress: 10, message: "Running pg_dump..." });

    execSync(`pg_dump "${databaseUrl}" -Fc -Z4 -f "${filepath}"`, {
      stdio: ["pipe", "pipe", "inherit"],
      timeout: 600000, // 10 min timeout
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    onProgress?.({ step: "dumping", progress: 60, message: "pg_dump completed" });

    // Get file size
    const stats = statSync(filepath);
    const sizeBytes = stats.size;

    // Calculate SHA256 checksum
    onProgress?.({ step: "dumping", progress: 70, message: "Calculating checksum..." });
    const checksum = await calculateChecksum(filepath);

    // Extract table list from backup
    const tables = extractTableList(filepath);

    const durationMs = Date.now() - startTime;

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
      // Ignore cleanup errors
    }
    throw new Error(`Backup failed: ${error}`);
  }
}

/**
 * Extracts list of tables from a pg_dump custom format file.
 */
function extractTableList(filepath: string): string[] {
  try {
    const output = execSync(`pg_restore -l "${filepath}" 2>/dev/null | grep "TABLE " | awk '{print $6}'`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    return output
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return [];
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
 * Formats bytes to human readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
 * Restores from a backup file - full or granular (specific tables).
 */
export async function restoreFromBackup(
  databaseUrl: string,
  backupPath: string,
  options: { tables?: string[]; dryRun?: boolean } = {}
): Promise<{ success: boolean; message: string }> {
  const { tables, dryRun } = options;

  let cmd = `pg_restore -d "${databaseUrl}" --clean --if-exists`;

  if (tables && tables.length > 0) {
    // Granular restore - only specific tables
    for (const table of tables) {
      cmd += ` -t "${table}"`;
    }
  }

  if (dryRun) {
    cmd += " --dry-run";
  }

  cmd += ` "${backupPath}"`;

  try {
    execSync(cmd, {
      stdio: "inherit",
      timeout: 1800000, // 30 min
    });

    return {
      success: true,
      message: tables ? `Restored tables: ${tables.join(", ")}` : "Full restore completed",
    };
  } catch (error) {
    return {
      success: false,
      message: String(error),
    };
  }
}
