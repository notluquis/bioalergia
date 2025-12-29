/**
 * Google Core - Shared Google API authentication and utilities
 *
 * Centralizes Google API auth for Calendar and Drive services.
 * Uses the same service account credentials as calendar sync.
 */

import { drive, drive_v3 } from "@googleapis/drive";
import { JWT } from "google-auth-library";
import { googleCalendarConfig } from "../config.js";
import { logEvent, logWarn } from "./logger.js";

// Scopes for Drive file operations
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file", // Create/edit files created by this app
];

// Cached clients
let cachedDriveClient: drive_v3.Drive | null = null;

/**
 * Gets the shared Google credentials from the existing calendar config.
 * Throws if not configured.
 */
export function getGoogleCredentials(): { email: string; privateKey: string } {
  if (!googleCalendarConfig) {
    throw new Error(
      "Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }
  return {
    email: googleCalendarConfig.serviceAccountEmail,
    privateKey: googleCalendarConfig.privateKey,
  };
}

/**
 * Checks if Google services are configured.
 */
export function isGoogleConfigured(): boolean {
  return googleCalendarConfig !== null;
}

/**
 * Gets an authenticated Google Drive client.
 * Reuses the same service account as calendar sync.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (cachedDriveClient) {
    return cachedDriveClient;
  }

  const creds = getGoogleCredentials();

  const auth = new JWT({
    email: creds.email,
    key: creds.privateKey,
    scopes: DRIVE_SCOPES,
  });

  await auth.authorize();
  cachedDriveClient = drive({ version: "v3", auth });
  return cachedDriveClient;
}

// ==================== BACKUP FOLDER MANAGEMENT ====================

const BACKUP_FOLDER_NAME = "finanzas-app-backups";
let cachedBackupFolderId: string | null = null;

/**
 * Gets or creates the backup folder in Google Drive.
 * The folder is created at the root of the service account's Drive.
 */
export async function getOrCreateBackupFolder(): Promise<string> {
  if (cachedBackupFolderId) {
    return cachedBackupFolderId;
  }

  const driveClient = await getDriveClient();

  // Search for existing folder
  const searchResponse = await driveClient.files.list({
    q: `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    pageSize: 1,
  });

  if (searchResponse.data.files && searchResponse.data.files.length > 0) {
    cachedBackupFolderId = searchResponse.data.files[0].id!;
    logEvent("google.backup.folder.found", { folderId: cachedBackupFolderId });
    return cachedBackupFolderId;
  }

  // Create folder if not exists
  logEvent("google.backup.folder.creating", { name: BACKUP_FOLDER_NAME });

  const createResponse = await driveClient.files.create({
    requestBody: {
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  cachedBackupFolderId = createResponse.data.id!;
  logEvent("google.backup.folder.created", { folderId: cachedBackupFolderId });

  return cachedBackupFolderId;
}

/**
 * Verifies the backup folder is accessible.
 */
export async function verifyBackupFolder(): Promise<{
  ok: boolean;
  folderId?: string;
  error?: string;
}> {
  try {
    const folderId = await getOrCreateBackupFolder();
    const driveClient = await getDriveClient();

    // Verify we can access it
    const response = await driveClient.files.get({
      fileId: folderId,
      fields: "id, name, webViewLink",
    });

    return {
      ok: true,
      folderId: response.data.id!,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logWarn("google.backup.folder.verify_failed", { error: message });
    return {
      ok: false,
      error: message,
    };
  }
}
