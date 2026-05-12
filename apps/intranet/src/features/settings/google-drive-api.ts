import { z } from "zod";
import { googleDriveORPCClient, toGoogleDriveApiError } from "./google-drive-orpc";

const GoogleDriveStatusSchema = z.object({
  configured: z.boolean(),
  error: z.string().optional(),
  errorCode: z.enum(["invalid_grant", "token_expired", "token_revoked", "unknown"]).optional(),
  source: z.enum(["db", "env", "none"]),
  valid: z.boolean(),
});

const GoogleDriveAuthUrlSchema = z.object({
  url: z.url(),
});

const GoogleDriveDisconnectSchema = z.object({
  success: z.literal(true),
});

export async function fetchGoogleDriveStatus(): Promise<z.infer<typeof GoogleDriveStatusSchema>> {
  try {
    return GoogleDriveStatusSchema.parse(await googleDriveORPCClient.googleStatus());
  } catch (error) {
    throw toGoogleDriveApiError(error);
  }
}

export async function fetchGoogleDriveAuthUrl(): Promise<{ url: string }> {
  try {
    return GoogleDriveAuthUrlSchema.parse(await googleDriveORPCClient.googleUrl());
  } catch (error) {
    throw toGoogleDriveApiError(error);
  }
}

export async function disconnectGoogleDrive(): Promise<{ success: true }> {
  try {
    return GoogleDriveDisconnectSchema.parse(await googleDriveORPCClient.googleDisconnect({}));
  } catch (error) {
    throw toGoogleDriveApiError(error);
  }
}
