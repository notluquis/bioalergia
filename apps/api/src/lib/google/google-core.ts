/**
 * Google Core - Shared Google API authentication and utilities
 *
 * Supports two authentication methods:
 * - Service Account (JWT): Used for Calendar sync
 * - OAuth 2.0: Used for Drive backups to personal account
 */

import { drive, drive_v3 } from "@googleapis/drive";
import { OAuth2Client } from "google-auth-library";
import { db } from "@finanzas/db";

import { googleCalendarConfig } from "../../config";

import { logEvent, logWarn } from "../logger";
import { parseGoogleError } from "./google-errors.js";

// Cached clients
let cachedDriveClient: drive_v3.Drive | null = null;
let cachedOAuthClient: OAuth2Client | null = null;
const OAUTH_TOKEN_KEY = "GOOGLE_OAUTH_REFRESH_TOKEN";

// ==================== SERVICE ACCOUNT (Calendar) ====================

/**
 * Gets the shared Google credentials from the existing calendar config.
 * Used for Calendar sync - NOT for Drive backups.
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

// ==================== OAUTH 2.0 (Drive) ====================

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Gets OAuth2 configuration from DB (System Setting) or environment variables.
 * DB takes precedence for refresh token.
 */
async function getOAuthConfig(): Promise<OAuthConfig | null> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  // 1. Try DB first
  const setting = await db.setting.findUnique({
    where: { key: OAUTH_TOKEN_KEY },
  });

  const refreshToken = setting?.value || process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!refreshToken) {
    return null;
  }

  return { clientId, clientSecret, refreshToken };
}

/**
 * Checks if OAuth is configured for Drive backups.
 * Now async because it checks DB.
 */
export async function isOAuthConfigured(): Promise<boolean> {
  const config = await getOAuthConfig();
  return config !== null;
}

/**
 * Gets an OAuth2 client for Drive operations.
 */
export async function getOAuthClientBase(): Promise<OAuth2Client> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth Client ID/Secret not configured in ENV.");
  }

  return new OAuth2Client(clientId, clientSecret, "urn:ietf:wg:oauth:2.0:oob");
}

/**
 * Gets an authenticated OAuth2 client for Drive operations.
 */
async function getOAuthClient(): Promise<OAuth2Client> {
  if (cachedOAuthClient) {
    return cachedOAuthClient;
  }

  const config = await getOAuthConfig();
  if (!config) {
    throw new Error(
      "OAuth no configurado. Conecta Google Drive desde la configuración."
    );
  }

  const oauth2Client = new OAuth2Client(
    config.clientId,
    config.clientSecret,
    "urn:ietf:wg:oauth:2.0:oob" // Desktop app redirect
  );

  oauth2Client.setCredentials({
    refresh_token: config.refreshToken,
  });

  // Verify the token works by getting a new access token
  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) throw new Error("No access token returned");

    logEvent("google.oauth.authenticated", {
      clientId: config.clientId.substring(0, 20) + "...",
      source:
        config.refreshToken === process.env.GOOGLE_OAUTH_REFRESH_TOKEN
          ? "env"
          : "db",
    });
  } catch (error) {
    const parsed = parseGoogleError(error);
    logWarn("google.oauth.auth_failed", {
      error: parsed.message,
      reason: parsed.reason,
      code: parsed.code,
    });
    // Don't throw logic here? If auth fails, maybe we just want to return a client that MIGHT fail later?
    // But throwing is safer to fail fast.
    throw new Error(`Error de autenticación OAuth: ${parsed.message}`);
  }

  cachedOAuthClient = oauth2Client;
  return cachedOAuthClient;
}

/**
 * Gets an authenticated Google Drive client using OAuth2.
 * Uses user's personal Google account for backup storage.
 */
export async function getDriveClient(): Promise<drive_v3.Drive> {
  if (cachedDriveClient) {
    return cachedDriveClient;
  }

  const auth = await getOAuthClient();
  cachedDriveClient = drive({ version: "v3", auth });
  return cachedDriveClient;
}

/**
 * Clears cached clients (useful for re-authentication).
 */
export function clearDriveClientCache(): void {
  cachedDriveClient = null;
  cachedOAuthClient = null;
}

// ==================== BACKUP FOLDER MANAGEMENT ====================

/**
 * Gets the backup folder ID from environment variable.
 */
export async function getBackupFolderId(): Promise<string> {
  const envFolderId = process.env.GOOGLE_BACKUP_FOLDER_ID;
  if (envFolderId) {
    logEvent("google.backup.folder.using_env", { folderId: envFolderId });
    return envFolderId;
  }

  throw new Error(
    "GOOGLE_BACKUP_FOLDER_ID no configurado. Crea una carpeta en tu Drive y agrega el ID como variable de entorno."
  );
}

/**
 * Verifies the backup folder is accessible.
 */
export async function verifyBackupFolder(): Promise<{
  ok: boolean;
  folderId?: string;
  folderName?: string;
  error?: string;
}> {
  try {
    const folderId = await getBackupFolderId();
    const driveClient = await getDriveClient();

    const response = await driveClient.files.get({
      fileId: folderId,
      fields: "id, name, webViewLink",
    });

    return {
      ok: true,
      folderId: response.data.id!,
      folderName: response.data.name!,
    };
  } catch (error) {
    const parsed = parseGoogleError(error);
    logWarn("google.backup.folder.verify_failed", { error: parsed.message });
    return {
      ok: false,
      error: parsed.message,
    };
  }
}
