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

    if (response.data.files?.length) {
      return response.data.files[0].id!;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: CERTIFICATES_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });

    return folder.data.id!;
  } catch (error) {
    throw parseGoogleError(error);
  }
}

export async function uploadCertificateToDrive(
  filepath: string,
  filename: string,
  metadata: Record<string, any>,
  pdfHash: string
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

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink || null,
    };
  } catch (error) {
    throw parseGoogleError(error);
  }
}
