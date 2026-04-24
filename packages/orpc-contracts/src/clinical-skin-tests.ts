import { oc } from "@orpc/contract";
import { z } from "zod";

export const skinTestImportStatusSchema = z.enum([
  "PENDING_REVIEW",
  "IMPORTED",
  "REJECTED",
  "ERROR",
  "SKIPPED",
]);

export const skinTestControlTypeSchema = z.enum(["POSITIVE", "NEGATIVE"]);

export const skinTestIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
});

export const skinTestResultSchema = z.object({
  id: z.string().optional(),
  section: z.string(),
  code: z.string().nullable(),
  allergenName: z.string(),
  papuleMm: z.number().nullable(),
  erythemaMm: z.number().nullable(),
  rawPapule: z.string().nullable(),
  rawErythema: z.string().nullable(),
  controlType: skinTestControlTypeSchema.nullable(),
  sortOrder: z.number().int(),
});

export const skinTestParsedPayloadSchema = z.object({
  header: z.object({
    ageLabel: z.string().nullable(),
    patientEmail: z.string().nullable(),
    patientName: z.string().nullable(),
    patientPhone: z.string().nullable(),
    patientRut: z.string().nullable(),
    panelTitle: z.string().nullable(),
    testDate: z.string().nullable(),
  }),
  results: z.array(skinTestResultSchema),
});

export const skinTestImportSchema = z.object({
  id: z.string(),
  confidence: z.number().int(),
  error: z.string().nullable(),
  filename: z.string(),
  importedAt: z.string().nullable(),
  issues: z.array(skinTestIssueSchema).catch([]),
  modifiedAt: z.string().nullable(),
  oneDriveWebUrl: z.string().nullable(),
  parsedPayload: skinTestParsedPayloadSchema.nullable(),
  path: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  skinTestId: z.string().nullable().optional(),
  matchedSeriesId: z.number().nullable().optional(),
  status: skinTestImportStatusSchema,
  updatedAt: z.string(),
});

export const skinTestDetailSchema = z.object({
  ageLabel: z.string().nullable(),
  clinicalSeriesId: z.number().int(),
  id: z.string(),
  panelTitle: z.string().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string().nullable(),
  patientPhone: z.string().nullable(),
  patientRut: z.string().nullable(),
  results: z.array(skinTestResultSchema),
  sourceImportId: z.string(),
  testDate: z.string(),
});

export const skinTestImportListInputSchema = z.object({
  confidenceMax: z.number().int().min(0).max(100).optional(),
  confidenceMin: z.number().int().min(0).max(100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  query: z.string().optional(),
  status: skinTestImportStatusSchema.optional(),
});

export const skinTestImportListOutputSchema = z.object({
  items: z.array(skinTestImportSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

export const skinTestImportActionInputSchema = z.object({
  id: z.string(),
  notes: z.string().max(500).optional(),
});

export const skinTestSyncInputSchema = z.object({
  folderPath: z.string().optional(),
  force: z.boolean().optional(),
});

export const skinTestSyncOutputSchema = z.object({
  jobId: z.string(),
});

export const skinTestJobStatusInputSchema = z.object({
  jobId: z.string(),
});

export const skinTestJobStatusOutputSchema = z.object({
  job: z.object({
    id: z.string(),
    type: z.string(),
    status: z.enum(["pending", "running", "completed", "failed"]),
    progress: z.number(),
    total: z.number(),
    message: z.string(),
    result: z.unknown(),
    error: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
});

export const oneDriveAccountStatusSchema = z.object({
  accountId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  folderPath: z.string().nullable(),
  lastDeltaSyncAt: z.string().nullable(),
  lastSyncAt: z.string().nullable(),
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
  folderPath: z.string().min(1),
});

export const oneDriveDisconnectInputSchema = z.object({
  accountId: z.string(),
});

export const oneDriveDisconnectOutputSchema = z.object({
  connected: z.boolean(),
});

export const skinTestsBySeriesInputSchema = z.object({
  clinicalSeriesId: z.number().int().positive(),
});

export const skinTestsBySeriesOutputSchema = z.object({
  tests: z.array(skinTestDetailSchema),
});

export const clinicalSkinTestsContract = {
  approveImport: oc
    .route({ method: "POST", path: "/imports/{id}/approve" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema),
  configureOneDriveFolder: oc
    .route({ method: "POST", path: "/onedrive/folder" })
    .input(oneDriveFolderInputSchema)
    .output(oneDriveStatusOutputSchema),
  connectOneDrive: oc
    .route({ method: "POST", path: "/onedrive/callback" })
    .input(oneDriveCallbackInputSchema)
    .output(oneDriveStatusOutputSchema),
  disconnectOneDrive: oc
    .route({ method: "POST", path: "/onedrive/disconnect" })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveDisconnectOutputSchema),
  getOneDriveAuthUrl: oc
    .route({ method: "GET", path: "/onedrive/auth-url" })
    .input(oneDriveAuthUrlInputSchema)
    .output(oneDriveAuthUrlOutputSchema),
  getOneDriveStatus: oc
    .route({ method: "GET", path: "/onedrive/status" })
    .input(z.object({}))
    .output(oneDriveStatusOutputSchema),
  importDetail: oc
    .route({ method: "GET", path: "/imports/{id}" })
    .input(z.object({ id: z.string() }))
    .output(skinTestImportSchema),
  jobStatus: oc
    .route({ method: "GET", path: "/jobs/{jobId}" })
    .input(skinTestJobStatusInputSchema)
    .output(skinTestJobStatusOutputSchema),
  listImports: oc
    .route({ method: "GET", path: "/imports" })
    .input(skinTestImportListInputSchema)
    .output(skinTestImportListOutputSchema),
  listTestsBySeries: oc
    .route({ method: "GET", path: "/series/{clinicalSeriesId}/tests" })
    .input(skinTestsBySeriesInputSchema)
    .output(skinTestsBySeriesOutputSchema),
  rejectImport: oc
    .route({ method: "POST", path: "/imports/{id}/reject" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema),
  reprocessImport: oc
    .route({ method: "POST", path: "/imports/{id}/reprocess" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema),
  sync: oc.route({ method: "POST", path: "/sync" }).input(skinTestSyncInputSchema).output(skinTestSyncOutputSchema),
};

export type ClinicalSkinTestsContract = typeof clinicalSkinTestsContract;
