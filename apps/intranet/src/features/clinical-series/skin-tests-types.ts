import { z } from "zod";

export const SkinTestImportStatusSchema = z.enum([
  "PENDING_REVIEW",
  "IMPORTED",
  "REJECTED",
  "ERROR",
  "SKIPPED",
]);

export type SkinTestImportStatus = z.infer<typeof SkinTestImportStatusSchema>;

export const SkinTestIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
});

export const SkinTestResultSchema = z.object({
  allergenName: z.string(),
  code: z.string().nullable(),
  controlType: z.enum(["POSITIVE", "NEGATIVE"]).nullable(),
  erythemaMm: z.number().nullable(),
  id: z.string().optional(),
  papuleMm: z.number().nullable(),
  rawErythema: z.string().nullable(),
  rawPapule: z.string().nullable(),
  section: z.string(),
  sortOrder: z.number(),
});

export type SkinTestResult = z.infer<typeof SkinTestResultSchema>;

export const SkinTestParsedPayloadSchema = z.object({
  header: z.object({
    ageLabel: z.string().nullable(),
    patientEmail: z.string().nullable(),
    patientName: z.string().nullable(),
    patientPhone: z.string().nullable(),
    patientRut: z.string().nullable(),
    panelTitle: z.string().nullable(),
    testDate: z.string().nullable(),
  }),
  results: z.array(SkinTestResultSchema),
});

export const SkinTestImportSchema = z.object({
  accountEmail: z.string().nullable(),
  accountName: z.string().nullable(),
  confidence: z.number(),
  error: z.string().nullable(),
  filename: z.string(),
  id: z.string(),
  importedAt: z.string().nullable(),
  issues: z.array(SkinTestIssueSchema).catch([]),
  modifiedAt: z.string().nullable(),
  oneDriveAccountId: z.string().nullable(),
  oneDriveWebUrl: z.string().nullable(),
  parsedPayload: SkinTestParsedPayloadSchema.nullable(),
  path: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  skinTestId: z.string().nullable().optional(),
  matchedSeriesId: z.number().nullable().optional(),
  status: SkinTestImportStatusSchema,
  updatedAt: z.string(),
});

export type SkinTestImport = z.infer<typeof SkinTestImportSchema>;

export const OneDriveFolderItemSchema = z.object({
  driveId: z.string().nullable(),
  hasChildren: z.boolean(),
  id: z.string(),
  isRemote: z.boolean(),
  name: z.string(),
  path: z.string().nullable(),
  webUrl: z.string().nullable(),
  xlsxCount: z.number(),
});

export type OneDriveFolderItem = z.infer<typeof OneDriveFolderItemSchema>;

export const OneDriveFolderFileSchema = z.object({
  id: z.string(),
  lastModifiedDateTime: z.string().nullable(),
  name: z.string(),
  size: z.number().nullable(),
  webUrl: z.string().nullable(),
});

export type OneDriveFolderFile = z.infer<typeof OneDriveFolderFileSchema>;

export const SkinTestDetailSchema = z.object({
  ageLabel: z.string().nullable(),
  clinicalSeriesId: z.number(),
  id: z.string(),
  panelTitle: z.string().nullable(),
  patientEmail: z.string().nullable(),
  patientName: z.string().nullable(),
  patientPhone: z.string().nullable(),
  patientRut: z.string().nullable(),
  results: z.array(SkinTestResultSchema),
  sourceImportId: z.string(),
  testDate: z.string(),
});

export type SkinTestDetail = z.infer<typeof SkinTestDetailSchema>;
