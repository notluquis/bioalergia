import { oc } from "@orpc/contract";
import { z } from "zod";

export const skinTestImportStatusSchema = z.enum([
  "DISCOVERED",
  "PENDING_REVIEW",
  "IMPORTED",
  "REJECTED",
  "ERROR",
  "SKIPPED",
]);

export const clinicalDocumentImportKindSchema = z.enum(["CLINICAL_RECORD", "VISIT_SHEET", "OTHER"]);

export const clinicalDocumentImportStatusSchema = z.enum([
  "DISCOVERED",
  "MATCHED",
  "UNMATCHED",
  "REJECTED",
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
  interpretation: z
    .object({
      address: z.string().nullable(),
      clinicalNote: z.string().nullable(),
      nonConclusiveDueToHyperreactivity: z.boolean(),
      physicianName: z.string().nullable(),
      physicianSpecialty: z.string().nullable(),
      suggestedEvaluation: z.string().nullable(),
      website: z.string().nullable(),
    })
    .optional(),
  results: z.array(skinTestResultSchema),
});

export const skinTestImportSchema = z.object({
  id: z.string(),
  accountEmail: z.string().nullable(),
  accountName: z.string().nullable(),
  oneDriveAccountId: z.string().nullable(),
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
  workbookSnapshot: z.object({
    archivedAt: z.string().nullable(),
    cellCount: z.number().int().nullable(),
    error: z.string().nullable(),
    extractorVersion: z.string().nullable(),
    mergeCount: z.number().int().nullable(),
    sheetName: z.string().nullable(),
    sha256: z.string().nullable(),
    status: z.enum(["MISSING", "ARCHIVED", "ERROR", "STALE"]),
    textHash: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
});

export const skinTestDetailSchema = z.object({
  ageLabel: z.string().nullable(),
  address: z.string().nullable(),
  clinicalNote: z.string().nullable(),
  clinicalSeriesId: z.number().int(),
  id: z.string(),
  nonConclusiveDueToHyperreactivity: z.boolean(),
  oneDriveWebUrl: z.string().nullable(),
  panelTitle: z.string().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string().nullable(),
  patientPhone: z.string().nullable(),
  patientRut: z.string().nullable(),
  physicianName: z.string().nullable(),
  physicianSpecialty: z.string().nullable(),
  resultHash: z.string().nullable(),
  results: z.array(skinTestResultSchema),
  sourceImportId: z.string(),
  testDate: z.string(),
  website: z.string().nullable(),
});

export const clinicalDocumentImportSchema = z.object({
  accountEmail: z.string().nullable(),
  accountName: z.string().nullable(),
  clinicalSeriesId: z.number().int().nullable(),
  documentKind: clinicalDocumentImportKindSchema,
  extractedPatientName: z.string().nullable(),
  filename: z.string(),
  id: z.string(),
  importedAt: z.string().nullable(),
  issues: z.array(skinTestIssueSchema).catch([]),
  modifiedAt: z.string().nullable(),
  oneDriveAccountId: z.string().nullable(),
  oneDriveWebUrl: z.string().nullable(),
  path: z.string().nullable(),
  size: z.number().int().nullable(),
  status: clinicalDocumentImportStatusSchema,
  updatedAt: z.string(),
});

export const skinTestImportListInputSchema = z.object({
  confidenceMax: z.number().int().min(0).max(100).optional(),
  confidenceMin: z.number().int().min(0).max(100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  query: z.string().optional(),
  snapshotStatus: z.enum(["MISSING", "ARCHIVED", "ERROR", "STALE"]).optional(),
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

export const skinTestBulkImportActionInputSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
});

export const skinTestBulkImportActionOutputSchema = z.object({
  errors: z.array(z.object({ id: z.string(), message: z.string() })),
  items: z.array(skinTestImportSchema),
});

export const skinTestProcessDiscoveredInputSchema = z.object({
  query: z.string().optional(),
});

export const skinTestArchiveSnapshotsInputSchema = z.object({
  accountId: z.string().optional(),
  dryRun: z.boolean().optional(),
  importStatus: skinTestImportStatusSchema.optional(),
  limit: z.number().int().positive().max(5000).optional(),
  onlyChanged: z.boolean().optional(),
  onlyMissing: z.boolean().optional(),
  query: z.string().optional(),
});

export const skinTestSyncInputSchema = z.object({
  accountId: z.string().optional(),
  folderDriveId: z.string().nullable().optional(),
  folderItemId: z.string().nullable().optional(),
  folderPath: z.string().optional(),
  force: z.boolean().optional(),
});

export const skinTestSyncOutputSchema = z.object({
  jobId: z.string(),
});

export const skinTestJobStatusInputSchema = z.object({
  jobId: z.string(),
});

const skinTestJobSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]),
  progress: z.number(),
  total: z.number(),
  message: z.string(),
  meta: z.record(z.string(), z.unknown()).nullable(),
  result: z.unknown(),
  error: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const skinTestJobStatusOutputSchema = z.object({
  job: skinTestJobSchema,
});

export const skinTestJobCancelInputSchema = z.object({
  jobId: z.string(),
});

export const skinTestJobCancelOutputSchema = z.object({
  cancelled: z.boolean(),
  job: skinTestJobSchema.nullable(),
});

export const skinTestActiveJobInputSchema = z.object({});

export const skinTestActiveJobOutputSchema = z.object({
  job: skinTestJobSchema.nullable(),
});

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

export const skinTestsBySeriesInputSchema = z.object({
  clinicalSeriesId: z.number().int().positive(),
});

export const skinTestsBySeriesOutputSchema = z.object({
  tests: z.array(skinTestDetailSchema),
});

export const clinicalDocumentsBySeriesOutputSchema = z.object({
  documents: z.array(clinicalDocumentImportSchema),
});

export const skinTestAnalyticsInputSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  examType: z.string().optional(),
  pageSize: z.number().int().positive().max(100).default(20),
  query: z.string().optional(),
});

export const skinTestAnalyticsOutputSchema = z.object({
  byExamType: z.array(
    z.object({
      examType: z.string(),
      total: z.number().int(),
    })
  ),
  byMonth: z.array(
    z.object({
      month: z.string(),
      total: z.number().int(),
    })
  ),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  patientsWithPositiveAllergen: z.number().int(),
  positiveAllergenResults: z.number().int(),
  positiveTests: z.number().int(),
  recentTests: z.array(
    z.object({
      clinicalSeriesId: z.number().int(),
      examType: z.string(),
      id: z.string(),
      oneDriveWebUrl: z.string().nullable(),
      panelTitle: z.string().nullable(),
      patientName: z.string().nullable(),
      patientRut: z.string().nullable(),
      resultCount: z.number().int(),
      testDate: z.string(),
    })
  ),
  topPatients: z.array(
    z.object({
      lastTestDate: z.string().nullable(),
      patientName: z.string().nullable(),
      patientRut: z.string().nullable(),
      totalTests: z.number().int(),
    })
  ),
  topAllergens: z.array(
    z.object({
      allergenName: z.string(),
      avgPapuleMm: z.number().nullable(),
      category: z.string().nullable(),
      code: z.string().nullable(),
      maxPapuleMm: z.number().nullable(),
      positiveResults: z.number().int(),
      section: z.string(),
      scientificName: z.string().nullable(),
      testCount: z.number().int(),
      uniquePatients: z.number().int(),
    })
  ),
  totalPatients: z.number().int(),
  totalResults: z.number().int(),
  totalTests: z.number().int(),
  withRut: z.number().int(),
  withoutRut: z.number().int(),
});

export const clinicalSkinTestsContract = {
  analytics: oc
    .route({ method: "GET", path: "/analytics" })
    .input(skinTestAnalyticsInputSchema)
    .output(skinTestAnalyticsOutputSchema),
  approveImport: oc
    .route({ method: "POST", path: "/imports/{id}/approve" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema),
  configureOneDriveFolder: oc
    .route({ method: "POST", path: "/onedrive/folder" })
    .input(oneDriveFolderInputSchema)
    .output(oneDriveStatusOutputSchema),
  listOneDriveFolderChildren: oc
    .route({ method: "GET", path: "/onedrive/folders" })
    .input(oneDriveFolderChildrenInputSchema)
    .output(oneDriveFolderChildrenOutputSchema),
  renewOneDriveSubscription: oc
    .route({ method: "POST", path: "/onedrive/subscription/renew" })
    .input(oneDriveDisconnectInputSchema)
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
  cancelJob: oc
    .route({ method: "POST", path: "/jobs/{jobId}/cancel" })
    .input(skinTestJobCancelInputSchema)
    .output(skinTestJobCancelOutputSchema),
  activeJob: oc
    .route({ method: "GET", path: "/jobs/active" })
    .input(skinTestActiveJobInputSchema)
    .output(skinTestActiveJobOutputSchema),
  listImports: oc
    .route({ method: "GET", path: "/imports" })
    .input(skinTestImportListInputSchema)
    .output(skinTestImportListOutputSchema),
  listTestsBySeries: oc
    .route({ method: "GET", path: "/series/{clinicalSeriesId}/tests" })
    .input(skinTestsBySeriesInputSchema)
    .output(skinTestsBySeriesOutputSchema),
  listDocumentsBySeries: oc
    .route({ method: "GET", path: "/series/{clinicalSeriesId}/documents" })
    .input(skinTestsBySeriesInputSchema)
    .output(clinicalDocumentsBySeriesOutputSchema),
  rejectImport: oc
    .route({ method: "POST", path: "/imports/{id}/reject" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema),
  reprocessImport: oc
    .route({ method: "POST", path: "/imports/{id}/reprocess" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema),
  processImports: oc
    .route({ method: "POST", path: "/imports/process" })
    .input(skinTestBulkImportActionInputSchema)
    .output(skinTestBulkImportActionOutputSchema),
  processDiscoveredImports: oc
    .route({ method: "POST", path: "/imports/process-discovered" })
    .input(skinTestProcessDiscoveredInputSchema)
    .output(skinTestSyncOutputSchema),
  reclassifyXlsxLibrary: oc
    .route({ method: "POST", path: "/xlsx-library/reclassify" })
    .input(z.object({}))
    .output(skinTestSyncOutputSchema),
  archiveSnapshots: oc
    .route({ method: "POST", path: "/imports/archive-snapshots" })
    .input(skinTestArchiveSnapshotsInputSchema)
    .output(skinTestSyncOutputSchema),
  sync: oc
    .route({ method: "POST", path: "/sync" })
    .input(skinTestSyncInputSchema)
    .output(skinTestSyncOutputSchema),
  folderPreview: oc
    .route({ method: "GET", path: "/onedrive/folder-preview" })
    .input(oneDriveFolderPreviewInputSchema)
    .output(oneDriveFolderPreviewOutputSchema),
};

export type ClinicalSkinTestsContract = typeof clinicalSkinTestsContract;
