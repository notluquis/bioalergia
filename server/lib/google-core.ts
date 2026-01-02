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

/**
 * Gets the backup folder ID from environment variable.
 * For personal Drive usage, the user should:
 * 1. Create a folder in their personal Drive
 * 2. Share it with the service account email (as Editor)
 * 3. Set GOOGLE_BACKUP_FOLDER_ID with the folder ID
 */
export async function getOrCreateBackupFolder(): Promise<string> {
  // Use env var if provided (recommended for personal Drive)
  const envFolderId = process.env.GOOGLE_BACKUP_FOLDER_ID;
  if (envFolderId) {
    logEvent("google.backup.folder.using_env", { folderId: envFolderId });
    return envFolderId;
  }

  // Fallback: try to create folder (only works with Shared Drives or domain delegation)
  throw new Error(
    "GOOGLE_BACKUP_FOLDER_ID is required. Create a folder in your Drive, share it with the service account, and set this env var."
  );
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
