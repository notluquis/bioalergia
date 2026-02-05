import { createReadStream } from "node:fs";
import { getDriveClient } from "../lib/google/google-core";
import { parseGoogleError, retryGoogleCall } from "../lib/google/google-errors";

const ATTACHMENTS_FOLDER_NAME = "Patient Attachments";

export async function getAttachmentsFolderId(): Promise<string> {
  try {
    const drive = await getDriveClient();

    const response = await retryGoogleCall(
      () =>
        drive.files.list({
          q: `name='${ATTACHMENTS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id)",
          spaces: "drive",
        }),
      { context: "drive.files.list" },
    );

    const existingFolderId = response.data.files?.[0]?.id;
    if (existingFolderId) {
      return existingFolderId;
    }

    const folder = await retryGoogleCall(
      () =>
        drive.files.create({
          requestBody: {
            name: ATTACHMENTS_FOLDER_NAME,
            mimeType: "application/vnd.google-apps.folder",
          },
          fields: "id",
        }),
      { idempotent: false, context: "drive.files.create" },
    );

    const folderId = folder.data.id;
    if (!folderId) {
      throw new Error("Drive did not return a folder id for patient attachments.");
    }

    return folderId;
  } catch (error) {
    throw parseGoogleError(error);
  }
}

export async function uploadPatientAttachmentToDrive(
  filepath: string,
  filename: string,
  mimeType: string,
  patientId: string,
): Promise<{ fileId: string; webViewLink: string | null }> {
  try {
    const drive = await getDriveClient();
    const folderId = await getAttachmentsFolderId();

    const response = await retryGoogleCall(
      () =>
        drive.files.create({
          requestBody: {
            name: filename,
            parents: [folderId],
            appProperties: {
              patientId,
              type: "attachment",
            },
          },
          media: {
            mimeType,
            body: createReadStream(filepath),
          },
          fields: "id,webViewLink",
        }),
      { idempotent: false, context: "drive.files.create" },
    );

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Drive did not return a file id for patient attachment.");
    }

    return {
      fileId,
      webViewLink: response.data.webViewLink || null,
    };
  } catch (error) {
    throw parseGoogleError(error);
  }
}
