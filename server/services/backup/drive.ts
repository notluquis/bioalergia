/**
 * Google Drive operations for backup service
 *
 * Uses OAuth2 via google-core for personal Drive access.
 * All errors are parsed through google-errors for clean messages.
 */

import { createReadStream, createWriteStream } from "fs";

import { getBackupFolderId, getDriveClient } from "../../lib/google-core.js";
import { GoogleApiError, parseGoogleError } from "../../lib/google-errors.js";

export interface DriveFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink?: string;
}

export interface UploadResult {
  fileId: string;
  webViewLink: string | null;
  md5Checksum: string | null;
}

/**
 * Uploads a backup file to Google Drive.
 */
export async function uploadToDrive(filepath: string, filename: string): Promise<UploadResult> {
  try {
    const drive = await getDriveClient();
    const folderId = await getBackupFolderId();

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
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
export async function downloadFromDrive(fileId: string, destPath: string): Promise<void> {
  try {
    const drive = await getDriveClient();
    const dest = createWriteStream(destPath);

    const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });

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
export async function listBackups(): Promise<DriveFile[]> {
  try {
    const drive = await getDriveClient();
    const folderId = await getBackupFolderId();

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id,name,createdTime,size,webViewLink)",
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
    }));
  } catch (error) {
    throw parseGoogleError(error);
  }
}

/**
 * Deletes old backups beyond retention period.
 */
export async function cleanupOldBackups(retentionDays: number): Promise<{
  deleted: number;
  deletedFiles: string[];
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const drive = await getDriveClient();
    const folderId = await getBackupFolderId();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false and createdTime < '${cutoffDate.toISOString()}'`,
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
export async function getBackupInfo(fileId: string): Promise<DriveFile | null> {
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
