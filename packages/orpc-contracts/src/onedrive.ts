import { oc } from "@orpc/contract";
import { z } from "zod";

// Generic OneDrive / Microsoft Graph account + folder + webhook management.
// Feature-agnostic: keyed only by accountId. Extracted from the skin-test
// contract so any feature (skin-tests, fichas clínicas, …) can connect an
// account, pick a scan folder and manage the change-notification webhook.
// The skin-test contract re-exports these schemas for backward compatibility.

export const oneDriveAccountStatusSchema = z.object({
  accountId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  folderDriveId: z.string().nullable(),
  folderItemId: z.string().nullable(),
  folderName: z.string().nullable(),
  folderPath: z.string().nullable(),
  lastDeltaSyncAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
  subscription: z.object({
    expiresAt: z.string().nullable(),
    resource: z.string().nullable(),
    status: z.enum(["ACTIVE", "EXPIRED", "MISSING"]),
    subscriptionId: z.string().nullable(),
  }),
});

export const oneDriveStatusOutputSchema = z.object({
  connected: z.boolean(),
  accounts: z.array(oneDriveAccountStatusSchema),
});

export const oneDriveAuthUrlInputSchema = z.object({
  redirectUri: z.string().url().optional(),
});

export const oneDriveAuthUrlOutputSchema = z.object({
  url: z.string(),
});

export const oneDriveCallbackInputSchema = z.object({
  code: z.string(),
  redirectUri: z.string().url().optional(),
});

export const oneDriveFolderInputSchema = z.object({
  accountId: z.string(),
  driveId: z.string().nullable().optional(),
  folderPath: z.string().optional(),
  itemId: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});

export const oneDriveFolderChildrenInputSchema = z.object({
  accountId: z.string(),
  driveId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
});

export const oneDriveFolderItemSchema = z.object({
  driveId: z.string().nullable(),
  hasChildren: z.boolean(),
  id: z.string(),
  isRemote: z.boolean(),
  name: z.string(),
  path: z.string().nullable(),
  webUrl: z.string().nullable(),
  xlsxCount: z.number().int(),
});

export const oneDriveFolderFileSchema = z.object({
  id: z.string(),
  lastModifiedDateTime: z.string().nullable(),
  name: z.string(),
  size: z.number().nullable(),
  webUrl: z.string().nullable(),
});

export const oneDriveFolderChildrenOutputSchema = z.object({
  files: z.array(oneDriveFolderFileSchema),
  folders: z.array(oneDriveFolderItemSchema),
  xlsxCount: z.number().int(),
});

export const oneDriveFolderPreviewInputSchema = z.object({
  accountId: z.string(),
  driveId: z.string().nullable().optional(),
  itemId: z.string().nullable().optional(),
});

export const oneDriveFolderPreviewOutputSchema = z.object({
  totalFiles: z.number().int(),
  xlsxCount: z.number().int(),
  xlsxTotalBytes: z.number().int(),
});

export const oneDriveDisconnectInputSchema = z.object({
  accountId: z.string(),
});

export const oneDriveDisconnectOutputSchema = z.object({
  connected: z.boolean(),
});

export const oneDriveContract = {
  getOneDriveStatus: oc
    .route({ method: "GET", path: "/status", tags: ["OneDrive"] })
    .input(z.object({}))
    .output(oneDriveStatusOutputSchema),
  getOneDriveAuthUrl: oc
    .route({ method: "GET", path: "/auth-url", tags: ["OneDrive"] })
    .input(oneDriveAuthUrlInputSchema)
    .output(oneDriveAuthUrlOutputSchema),
  connectOneDrive: oc
    .route({ method: "POST", path: "/callback", tags: ["OneDrive"] })
    .input(oneDriveCallbackInputSchema)
    .output(oneDriveStatusOutputSchema),
  disconnectOneDrive: oc
    .route({ method: "POST", path: "/disconnect", tags: ["OneDrive"] })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveDisconnectOutputSchema),
  configureOneDriveFolder: oc
    .route({ method: "POST", path: "/folder", tags: ["OneDrive"] })
    .input(oneDriveFolderInputSchema)
    .output(oneDriveStatusOutputSchema),
  listOneDriveFolderChildren: oc
    .route({ method: "GET", path: "/folders", tags: ["OneDrive"] })
    .input(oneDriveFolderChildrenInputSchema)
    .output(oneDriveFolderChildrenOutputSchema),
  folderPreview: oc
    .route({ method: "GET", path: "/folder-preview", tags: ["OneDrive"] })
    .input(oneDriveFolderPreviewInputSchema)
    .output(oneDriveFolderPreviewOutputSchema),
  renewOneDriveSubscription: oc
    .route({ method: "POST", path: "/subscription/renew", tags: ["OneDrive"] })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveStatusOutputSchema),
};

export type OneDriveContract = typeof oneDriveContract;
