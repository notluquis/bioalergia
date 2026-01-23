import { createReadStream } from "node:fs";
import { getDriveClient } from "../lib/google/google-core";
import { parseGoogleError } from "../lib/google/google-errors";

const ATTACHMENTS_FOLDER_NAME = "Patient Attachments";

export async function getAttachmentsFolderId(): Promise<string> {
  try {
    const drive = await getDriveClient();
    
    const response = await drive.files.list({
      q: `name='${ATTACHMENTS_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    // biome-ignore lint/style/noNonNullAssertion: drive file list returns array if successful
    if (response.data.files?.length) {
      // biome-ignore lint/style/noNonNullAssertion: drive file should have id
      return response.data.files[0].id!;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: ATTACHMENTS_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    // biome-ignore lint/style/noNonNullAssertion: drive creation should return id
    return folder.data.id!;
  } catch (error) {
    throw parseGoogleError(error);
  }
}

export async function uploadPatientAttachmentToDrive(
  filepath: string,
  filename: string,
  mimeType: string,
  patientId: string
): Promise<{ fileId: string; webViewLink: string | null }> {
  try {
    const drive = await getDriveClient();
    const folderId = await getAttachmentsFolderId();

    const response = await drive.files.create({
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
    });

    // biome-ignore lint/style/noNonNullAssertion: drive upload returns id
    return {
      // biome-ignore lint/style/noNonNullAssertion: drive upload returns id
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink || null,
    };
  } catch (error) {
    throw parseGoogleError(error);
  }
}
