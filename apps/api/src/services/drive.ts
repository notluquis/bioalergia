/**
 * Google Drive operations for backup service
 *
 * Uses OAuth2 via google-core for personal Drive access.
 * All errors are parsed through google-errors for clean messages.
 */
import { createReadStream, createWriteStream } from "fs";
import dayjs from "dayjs";

import { getDriveClient, getBackupFolderId } from "../lib/google/google-core";
import { parseGoogleError, GoogleApiError } from "../lib/google/google-errors";

export interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink?: string;
  customChecksum?: string;
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

    const response = await drive.files.create({
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
    });

    return {
      fileId: response.data.id!,
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
export async function downloadFromDrive(
  fileId: string,
  destPath: string,
): Promise<void> {
  try {
    const drive = await getDriveClient();
    const dest = createWriteStream(destPath);

    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );

    await new Promise<void>((resolve, reject) => {
      (response.data as NodeJS.ReadableStream)
        .pipe(dest)
        .on("finish", resolve)
        .on("error", reject);
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

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,createdTime,size,webViewLink,appProperties)",
      orderBy: "createdTime desc",
      pageSize: 100,
      supportsAllDrives: true,
    });

    return (response.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
      createdTime: f.createdTime!,
      size: f.size || "0",
      webViewLink: f.webViewLink || undefined,
      customChecksum: f.appProperties?.customChecksum,
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

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and createdTime < '${cutoffDate}'`,
      fields: "files(id,name,createdTime)",
      pageSize: 100,
      supportsAllDrives: true,
    });

    const files = response.data.files || [];
    const deletedFiles: string[] = [];

    for (const file of files) {
      try {
        await drive.files.delete({ fileId: file.id!, supportsAllDrives: true });
        deletedFiles.push(file.name!);
      } catch (deleteError) {
        const parsed = parseGoogleError(deleteError);
        errors.push(`${file.name}: ${parsed.message}`);
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
export async function getBackupInfo(
  fileId: string,
): Promise<BackupFile | null> {
  try {
    const drive = await getDriveClient();

    const response = await drive.files.get({
      fileId,
      fields: "id,name,createdTime,size,webViewLink",
      supportsAllDrives: true,
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      createdTime: response.data.createdTime!,
      size: response.data.size || "0",
      webViewLink: response.data.webViewLink || undefined,
    };
  } catch (error) {
    if (error instanceof GoogleApiError && error.code === 404) {
      return null;
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
      const metadata = await drive.files.get({
        fileId,
        fields: "description",
        supportsAllDrives: true,
      });

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
    const { createGunzip } = await import("zlib");
    const streamModule = await import("stream");

    // Get file as stream and read just enough to get the tables list
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" },
    );

    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      let bytesRead = 0;
      const maxBytes = 50 * 1024; // Read max 50KB to find tables
      let stopped = false;

      // Cast to Node.js Readable stream using the imported module type
      const dataStream = response.data as InstanceType<
        typeof streamModule.Readable
      >;

      const onData = (chunk: Buffer) => {
        if (stopped) return;
        if (bytesRead < maxBytes) {
          chunks.push(chunk);
          bytesRead += chunk.length;
        }
        if (bytesRead >= maxBytes && !stopped) {
          stopped = true;
          cleanup();
          processChunks();
        }
      };

      const onEnd = () => {
        if (!stopped) {
          cleanup();
          processChunks();
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

      function processChunks() {
        try {
          const buffer = Buffer.concat(chunks);
          const gunzip = createGunzip();
          const decompressed: Buffer[] = [];

          gunzip.on("data", (chunk: Buffer) => decompressed.push(chunk));
          gunzip.on("end", () => {
            try {
              // We only have the beginning of the file, so it's invalid JSON.
              // But we can extract the "tables":[...] part using regex.
              const cleanText = Buffer.concat(decompressed).toString();

              // Match "tables": ["Table1", "Table2", ...]
              // Handles optional whitespace
              const match = cleanText.match(/"tables"\s*:\s*(\[[^\]]*\])/);

              if (match && match[1]) {
                try {
                  const tables = JSON.parse(match[1]);
                  if (Array.isArray(tables)) {
                    resolve(tables);
                    return;
                  }
                } catch (e) {
                  // Ignore inner parse error
                }
              }

              // Fallback: If we can't find tables, return empty
              console.warn(
                "[Drive] Could not extract tables from backup header",
              );
              resolve([]);
            } catch {
              resolve([]);
            }
          });
          gunzip.on("error", () => resolve([]));
          gunzip.end(buffer);
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
 * Returns null if metadata is missing or legacy backup.
 */
export async function getBackupStats(
  fileId: string,
): Promise<Record<string, { count: number; hash: string }> | null> {
  try {
    const drive = await getDriveClient();
    const metadata = await drive.files.get({
      fileId,
      fields: "description",
      supportsAllDrives: true,
    });

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
    return null;
  } catch (error) {
    console.warn(`[Drive] Failed to get stats for ${fileId}`, error);
    return null;
  }
}
