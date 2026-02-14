/**
 * Google Drive operations for backup service
 *
 * Uses OAuth2 via google-core for personal Drive access.
 * All errors are parsed through google-errors for clean messages.
 */

import { createReadStream, createWriteStream } from "node:fs";
import dayjs from "dayjs";

import { getBackupFolderId, getDriveClient } from "../lib/google/google-core";
import { GoogleApiError, parseGoogleError, retryGoogleCall } from "../lib/google/google-errors";

export interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink?: string;
  customChecksum?: string;
}

const TABLES_REGEX = /"tables"\s*:\s*(\[[^\]]*\])/;

function extractTablesFromBackupHeader(cleanText: string): string[] {
  const match = cleanText.match(TABLES_REGEX);
  if (!match?.[1]) {
    console.warn("[Drive] Could not extract tables from backup header");
    return [];
  }

  try {
    const tables = JSON.parse(match[1]);
    return Array.isArray(tables) ? tables : [];
  } catch {
    return [];
  }
}

async function unzipAndExtractTables(buffer: Buffer): Promise<string[]> {
  const { createGunzip } = await import("node:zlib");

  return new Promise((resolve) => {
    const gunzip = createGunzip();
    const decompressed: Buffer[] = [];

    gunzip.on("data", (chunk: Buffer) => {
      decompressed.push(chunk);
    });
    gunzip.on("end", () => {
      const cleanText = Buffer.concat(decompressed).toString();
      resolve(extractTablesFromBackupHeader(cleanText));
    });
    gunzip.on("error", () => {
      resolve([]);
    });

    gunzip.end(buffer);
  });
}

/**
 * Uploads a backup file to Google Drive.
 */
export async function uploadToDrive(
  filepath: string,
  filename: string,
  tables: string[] = [], // Optional for backward compatibility
  checksum?: string, // Optional custom checksum (SHA256)
  stats?: Record<string, { count: number; hash: string }>, // Optional granular stats
): Promise<{
  fileId: string;
  webViewLink: string | null;
  md5Checksum: string | null;
}> {
  try {
    const drive = await getDriveClient();
    const folderId = await getBackupFolderId();

    const response = await retryGoogleCall(
      () =>
        drive.files.create({
          requestBody: {
            name: filename,
            parents: [folderId],
            description: JSON.stringify({ tables, stats }), // Store tables & stats in description (16KB limit)
            appProperties: {
              backupVersion: "1.0",
              customChecksum: checksum || "", // Store custom checksum (64 bytes)
            },
          },
          media: {
            mimeType: "application/octet-stream",
            body: createReadStream(filepath),
          },
          fields: "id,name,size,md5Checksum,webViewLink",
          supportsAllDrives: true,
        }),
      {
        idempotent: false,
        context: "drive.files.create",
      },
    );

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Google Drive no devolvió ID del archivo");
    }

    return {
      fileId,
      webViewLink: response.data.webViewLink || null,
      md5Checksum: response.data.md5Checksum || null,
    };
  } catch (error) {
    throw parseGoogleError(error);
  }
}

/**
 * Downloads a backup file from Google Drive.
 */
export async function downloadFromDrive(fileId: string, destPath: string): Promise<void> {
  try {
    const drive = await getDriveClient();
    const dest = createWriteStream(destPath);

    const response = await retryGoogleCall(
      () => drive.files.get({ fileId, alt: "media" }, { responseType: "stream" }),
      { context: "drive.files.get" },
    );

    await new Promise<void>((resolve, reject) => {
      (response.data as NodeJS.ReadableStream).pipe(dest).on("finish", resolve).on("error", reject);
    });
  } catch (error) {
    throw parseGoogleError(error);
  }
}

/**
 * Lists all backup files in the folder.
 */
export async function listBackups(): Promise<BackupFile[]> {
  try {
    const drive = await getDriveClient();
    const folderId = await getBackupFolderId();

    const response = await retryGoogleCall(
      () =>
        drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          fields: "files(id,name,createdTime,size,webViewLink,appProperties)",
          orderBy: "createdTime desc",
          pageSize: 100,
          supportsAllDrives: true,
        }),
      { context: "drive.files.list" },
    );

    return (response.data.files || [])
      .filter((file) => file.id && file.name && file.createdTime)
      .map((file) => ({
        id: file.id as string,
        name: file.name as string,
        createdTime: file.createdTime as string,
        size: file.size || "0",
        webViewLink: file.webViewLink || undefined,
        customChecksum: file.appProperties?.customChecksum,
      }));
  } catch (error) {
    throw parseGoogleError(error);
  }
}

/**
 * Deletes old backups beyond retention period.
 */
export async function cleanupOldBackups(
  retentionDays: number,
): Promise<{ deleted: number; deletedFiles: string[]; errors: string[] }> {
  const errors: string[] = [];

  try {
    const drive = await getDriveClient();
    const folderId = await getBackupFolderId();

    const cutoffDate = dayjs().subtract(retentionDays, "day").toISOString();

    const response = await retryGoogleCall(
      () =>
        drive.files.list({
          q: `'${folderId}' in parents and trashed = false and createdTime < '${cutoffDate}'`,
          fields: "files(id,name,createdTime)",
          pageSize: 100,
          supportsAllDrives: true,
        }),
      { context: "drive.files.list" },
    );

    const files = response.data.files || [];
    const deletedFiles: string[] = [];

    for (const file of files) {
      const fileId = file.id ?? undefined;
      const fileName = file.name ?? "Sin nombre";

      if (!fileId) {
        errors.push(`${fileName}: missing file id`);
        continue;
      }

      try {
        await retryGoogleCall(() => drive.files.delete({ fileId, supportsAllDrives: true }), {
          context: "drive.files.delete",
        });
        deletedFiles.push(fileName);
      } catch (deleteError) {
        const parsed = parseGoogleError(deleteError);
        errors.push(`${fileName}: ${parsed.message}`);
      }
    }

    return { deleted: deletedFiles.length, deletedFiles, errors };
  } catch (error) {
    throw parseGoogleError(error);
  }
}

/**
 * Gets metadata for a specific file.
 */
export async function getBackupInfo(fileId: string): Promise<BackupFile> {
  try {
    const drive = await getDriveClient();

    const response = await retryGoogleCall(
      () =>
        drive.files.get({
          fileId,
          fields: "id,name,createdTime,size,webViewLink",
          supportsAllDrives: true,
        }),
      { context: "drive.files.get" },
    );

    const { id, name, createdTime, size, webViewLink } = response.data;

    if (!id || !name || !createdTime) {
      throw new Error("Incomplete backup metadata from Google Drive");
    }

    return {
      id,
      name,
      createdTime,
      size: size || "0",
      webViewLink: webViewLink || undefined,
    };
  } catch (error) {
    if (error instanceof GoogleApiError && error.code === 404) {
      throw new Error(`Backup file with ID ${fileId} not found`);
    }
    throw parseGoogleError(error);
  }
}

/**
 * Gets tables contained in a backup file.
 * Downloads the file header to extract table names.
 */
export async function getBackupTables(fileId: string): Promise<string[]> {
  try {
    const drive = await getDriveClient();

    // 1. Try to get tables from metadata (Fastest)
    try {
      const metadata = await retryGoogleCall(
        () =>
          drive.files.get({
            fileId,
            fields: "description",
            supportsAllDrives: true,
          }),
        { context: "drive.files.get" },
      );

      if (metadata.data.description) {
        try {
          const desc = JSON.parse(metadata.data.description);
          if (desc.tables && Array.isArray(desc.tables)) {
            return desc.tables;
          }
        } catch {
          // Description might not be JSON, ignore
        }
      }
    } catch (e) {
      console.warn(
        `[Drive] Metadata check failed for ${fileId}, falling back to stream parsing`,
        e,
      );
    }

    // 2. Fallback: Parse file header (Slower)
    const streamModule = await import("node:stream");

    // Get file as stream and read just enough to get the tables list
    const response = await retryGoogleCall(
      () => drive.files.get({ fileId, alt: "media" }, { responseType: "stream" }),
      { context: "drive.files.get" },
    );

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let bytesRead = 0;
      const maxBytes = 50 * 1024; // Read max 50KB to find tables
      let stopped = false;

      // Cast to Node.js Readable stream using the imported module type
      const dataStream = response.data as InstanceType<typeof streamModule.Readable>;

      const onData = (chunk: Buffer) => {
        if (stopped) {
          return;
        }
        if (bytesRead < maxBytes) {
          chunks.push(chunk);
          bytesRead += chunk.length;
        }
        if (bytesRead >= maxBytes && !stopped) {
          stopped = true;
          cleanup();
          void processChunks();
        }
      };

      const onEnd = () => {
        if (!stopped) {
          cleanup();
          void processChunks();
        }
      };

      const onError = () => {
        cleanup();
        resolve([]);
      };

      const cleanup = () => {
        dataStream.removeListener("data", onData);
        dataStream.removeListener("end", onEnd);
        dataStream.removeListener("error", onError);
        // Safely check and call destroy if it exists (it should on Node streams)
        if (typeof dataStream.destroy === "function") {
          dataStream.destroy();
        }
      };

      dataStream.on("data", onData);
      dataStream.on("end", onEnd);
      dataStream.on("error", onError);

      async function processChunks() {
        try {
          const buffer = Buffer.concat(chunks);
          const tables = await unzipAndExtractTables(buffer);
          resolve(tables);
        } catch {
          resolve([]);
        }
      }
    });
  } catch (error) {
    throw parseGoogleError(error);
  }
}

/**
 * Gets granular stats (hash, count) from backup metadata.
 * Throws error if metadata is missing or invalid.
 */
export async function getBackupStats(
  fileId: string,
): Promise<Record<string, { count: number; hash: string }>> {
  try {
    const drive = await getDriveClient();
    const metadata = await retryGoogleCall(
      () =>
        drive.files.get({
          fileId,
          fields: "description",
          supportsAllDrives: true,
        }),
      { context: "drive.files.get" },
    );

    if (metadata.data.description) {
      try {
        const desc = JSON.parse(metadata.data.description);
        if (desc.stats) {
          return desc.stats;
        }
      } catch {
        // Ignore JSON error
      }
    }
    throw new Error(`No stats found in metadata for file ${fileId}`);
  } catch (error) {
    console.warn(`[Drive] Failed to get stats for ${fileId}`, error);
    throw parseGoogleError(error);
  }
}
