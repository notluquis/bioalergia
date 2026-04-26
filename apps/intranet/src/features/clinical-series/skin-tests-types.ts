import { z } from "zod";

export const SkinTestImportStatusSchema = z.enum([
  "DISCOVERED",
  "PENDING_REVIEW",
  "IMPORTED",
  "REJECTED",
  "ERROR",
  "SKIPPED",
]);

export type SkinTestImportStatus = z.infer<typeof SkinTestImportStatusSchema>;

export const ClinicalDocumentImportKindSchema = z.enum(["CLINICAL_RECORD", "VISIT_SHEET", "OTHER"]);

export const ClinicalDocumentImportStatusSchema = z.enum([
  "DISCOVERED",
  "MATCHED",
  "UNMATCHED",
  "REJECTED",
  "SKIPPED",
]);

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
  address: z.string().nullable(),
  clinicalNote: z.string().nullable(),
  clinicalSeriesId: z.number(),
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
  results: z.array(SkinTestResultSchema),
  sourceImportId: z.string(),
  testDate: z.string(),
  website: z.string().nullable(),
});

export type SkinTestDetail = z.infer<typeof SkinTestDetailSchema>;

export const ClinicalDocumentImportSchema = z.object({
  accountEmail: z.string().nullable(),
  accountName: z.string().nullable(),
  clinicalSeriesId: z.number().nullable(),
  documentKind: ClinicalDocumentImportKindSchema,
  extractedPatientName: z.string().nullable(),
  filename: z.string(),
  id: z.string(),
  importedAt: z.string().nullable(),
  issues: z.array(SkinTestIssueSchema).catch([]),
  modifiedAt: z.string().nullable(),
  oneDriveAccountId: z.string().nullable(),
  oneDriveWebUrl: z.string().nullable(),
  path: z.string().nullable(),
  size: z.number().nullable(),
  status: ClinicalDocumentImportStatusSchema,
  updatedAt: z.string(),
});

export type ClinicalDocumentImport = z.infer<typeof ClinicalDocumentImportSchema>;

export const SkinTestAnalyticsSchema = z.object({
  byExamType: z.array(
    z.object({
      examType: z.string(),
      total: z.number(),
    })
  ),
  byMonth: z.array(
    z.object({
      month: z.string(),
      total: z.number(),
    })
  ),
  dateFrom: z.string().nullable(),
  dateTo: z.string().nullable(),
  patientsWithPositiveAllergen: z.number(),
  positiveAllergenResults: z.number(),
  positiveTests: z.number(),
  recentTests: z.array(
    z.object({
      clinicalSeriesId: z.number(),
      examType: z.string(),
      id: z.string(),
      oneDriveWebUrl: z.string().nullable(),
      panelTitle: z.string().nullable(),
      patientName: z.string().nullable(),
      patientRut: z.string().nullable(),
      resultCount: z.number(),
      testDate: z.string(),
    })
  ),
  topPatients: z.array(
    z.object({
      lastTestDate: z.string().nullable(),
      patientName: z.string().nullable(),
      patientRut: z.string().nullable(),
      totalTests: z.number(),
    })
  ),
  topAllergens: z.array(
    z.object({
      allergenName: z.string(),
      avgPapuleMm: z.number().nullable(),
      code: z.string().nullable(),
      maxPapuleMm: z.number().nullable(),
      positiveResults: z.number(),
      section: z.string(),
      testCount: z.number(),
      uniquePatients: z.number(),
    })
  ),
  totalPatients: z.number(),
  totalResults: z.number(),
  totalTests: z.number(),
  withRut: z.number(),
  withoutRut: z.number(),
});

export type SkinTestAnalytics = z.infer<typeof SkinTestAnalyticsSchema>;
