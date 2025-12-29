/**
 * Google Drive operations for backup service
 *
 * Uses the shared google-core module for authentication.
 */

import { createReadStream, createWriteStream } from "fs";
import { getDriveClient, getOrCreateBackupFolder } from "../../lib/google-core.js";

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
  const drive = await getDriveClient();
  const folderId = await getOrCreateBackupFolder();

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
  });

  return {
    fileId: response.data.id!,
    webViewLink: response.data.webViewLink || null,
    md5Checksum: response.data.md5Checksum || null,
  };
}

/**
 * Downloads a backup file from Google Drive.
 */
export async function downloadFromDrive(fileId: string, destPath: string): Promise<void> {
  const drive = await getDriveClient();
  const dest = createWriteStream(destPath);

  const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });

  await new Promise<void>((resolve, reject) => {
    (response.data as NodeJS.ReadableStream).pipe(dest).on("finish", resolve).on("error", reject);
  });
}

/**
 * Lists all backup files in the folder.
 */
export async function listBackups(): Promise<DriveFile[]> {
  const drive = await getDriveClient();
  const folderId = await getOrCreateBackupFolder();

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,createdTime,size,webViewLink)",
    orderBy: "createdTime desc",
    pageSize: 100,
  });

  return (response.data.files || []).map((f) => ({
    id: f.id!,
    name: f.name!,
    createdTime: f.createdTime!,
    size: f.size || "0",
    webViewLink: f.webViewLink || undefined,
  }));
}

/**
 * Deletes old backups beyond retention period.
 */
export async function cleanupOldBackups(retentionDays: number): Promise<{
  deleted: number;
  deletedFiles: string[];
}> {
  const drive = await getDriveClient();
  const folderId = await getOrCreateBackupFolder();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and createdTime < '${cutoffDate.toISOString()}'`,
    fields: "files(id,name,createdTime)",
    pageSize: 100,
  });

  const files = response.data.files || [];
  const deletedFiles: string[] = [];

  for (const file of files) {
    try {
      await drive.files.delete({ fileId: file.id! });
      deletedFiles.push(file.name!);
    } catch (error) {
      console.error(`Failed to delete ${file.name}:`, error);
    }
  }

  return { deleted: deletedFiles.length, deletedFiles };
}

/**
 * Gets metadata for a specific file.
 */
export async function getBackupInfo(fileId: string): Promise<DriveFile | null> {
  const drive = await getDriveClient();

  try {
    const response = await drive.files.get({
      fileId,
      fields: "id,name,createdTime,size,webViewLink",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      createdTime: response.data.createdTime!,
      size: response.data.size || "0",
      webViewLink: response.data.webViewLink || undefined,
    };
  } catch {
    return null;
  }
}
