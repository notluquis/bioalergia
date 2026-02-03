import { createReadStream } from "node:fs";
import { getDriveClient } from "../lib/google/google-core";
import { parseGoogleError } from "../lib/google/google-errors";

const CERTIFICATES_FOLDER_NAME = "Medical Certificates";

export async function getCertificatesFolderId(): Promise<string> {
  try {
    const drive = await getDriveClient();
    
    const response = await drive.files.list({
      q: `name='${CERTIFICATES_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id)",
      spaces: "drive",
    });

    const existingId = response.data.files?.[0]?.id;
    if (existingId) {
      return existingId;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: CERTIFICATES_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    const folderId = folder.data.id;
    if (!folderId) {
      throw new Error("Google Drive: missing folder id for certificates");
    }
    return folderId;
  } catch (error) {
    throw parseGoogleError(error);
  }
}

export async function uploadCertificateToDrive(
  filepath: string,
  filename: string,
  metadata: Record<string, unknown>,
  pdfHash: string,
): Promise<{ fileId: string; webViewLink: string | null }> {
  try {
    const drive = await getDriveClient();
    const folderId = await getCertificatesFolderId();

    const response = await drive.files.create({
      requestBody: {
        name: filename,
        parents: [folderId],
        description: JSON.stringify(metadata),
        appProperties: {
          pdfHash,
          certificateType: "medical",
        },
      },
      media: {
        mimeType: "application/pdf",
        body: createReadStream(filepath),
      },
      fields: "id,webViewLink",
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error("Google Drive: missing file id for certificate upload");
    }

    return {
      fileId,
      webViewLink: response.data.webViewLink || null,
    };
  } catch (error) {
    throw parseGoogleError(error);
  }
}
