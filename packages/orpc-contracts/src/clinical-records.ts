import { oc } from "@orpc/contract";
import { z } from "zod";

// Clinical records (fichas clínicas) — read-only contract for the
// PENDING_REVIEW queue + the IMPORTED detail view. Mutations are
// limited to operator approve / reject / reprocess; no field-level
// edits, the xlsx in OneDrive remains source of truth (per
// CLAUDE.local.md feature scope decision).

export const clinicalRecordImportStatusSchema = z.enum([
  "DISCOVERED",
  "PENDING_REVIEW",
  "IMPORTED",
  "REJECTED",
  "ERROR",
  "SKIPPED",
  "TEMPLATE",
]);

export const clinicalRecordIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["info", "warning", "error"]),
});

export const clinicalRecordMatchCandidateSchema = z.object({
  patientId: z.number().int(),
  personId: z.number().int(),
  fullName: z.string(),
  rut: z.string().nullable(),
  birthDate: z.string().nullable(),
  score: z.number(),
  reason: z.string(),
});

export const clinicalRecordParsedPayloadSchema = z.object({
  consultDate: z.string().nullable(),
  patientName: z.string().nullable(),
  ageLabel: z.string().nullable(),
  history: z.string().nullable(),
  physicalExam: z.string().nullable(),
  diagnosis: z.string().nullable(),
  indications: z.array(z.string()),
  weightKg: z.number().nullable(),
  heightCm: z.number().nullable(),
  headCircumferenceCm: z.number().nullable(),
  anthropometric: z.record(z.string(), z.string()),
  rawHeader: z.record(z.string(), z.string()),
});

export const clinicalRecordImportSchema = z.object({
  id: z.string(),
  filename: z.string(),
  status: clinicalRecordImportStatusSchema,
  parserVersion: z.string(),
  confidence: z.number().int(),
  error: z.string().nullable(),
  issues: z.array(clinicalRecordIssueSchema),
  parsedPayload: clinicalRecordParsedPayloadSchema.nullable(),
  matchedPatientId: z.number().int().nullable(),
  matchedClinicalSeriesId: z.number().int().nullable(),
  matchCandidates: z.array(clinicalRecordMatchCandidateSchema),
  reviewedBy: z.number().int().nullable(),
  reviewedAt: z.date().nullable(),
  reviewNotes: z.string().nullable(),
  importedAt: z.date().nullable(),
  oneDriveAccountId: z.string().nullable(),
  oneDriveItemId: z.string(),
  oneDriveWebUrl: z.string().nullable(),
  modifiedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const clinicalRecordSchema = z.object({
  id: z.string(),
  clinicalSeriesId: z.number().int(),
  sourceImportId: z.string(),
  consultDate: z.string().nullable(),
  patientName: z.string().nullable(),
  ageLabel: z.string().nullable(),
  history: z.string().nullable(),
  physicalExam: z.string().nullable(),
  diagnosis: z.string().nullable(),
  indications: z.array(z.string()),
  weightKg: z.number().nullable(),
  heightCm: z.number().nullable(),
  headCircumferenceCm: z.number().nullable(),
  anthropometric: z.record(z.string(), z.string()),
  rawHeader: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const idInput = z.object({ id: z.string().min(1) });

export const clinicalRecordsContract = {
  listImports: oc
    .route({ method: "POST", path: "/imports/list", tags: ["Clinical Records"] })
    .input(
      z.object({
        status: clinicalRecordImportStatusSchema.optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
        search: z.string().optional(),
      }),
    )
    .output(
      z.object({
        items: z.array(clinicalRecordImportSchema),
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
      }),
    ),

  getImport: oc
    .route({ method: "POST", path: "/imports/get", tags: ["Clinical Records"] })
    .input(idInput)
    .output(clinicalRecordImportSchema),

  reprocessImport: oc
    .route({ method: "POST", path: "/imports/reprocess", tags: ["Clinical Records"] })
    .input(idInput)
    .output(
      z.object({
        status: clinicalRecordImportStatusSchema,
        candidates: z.number().int().optional(),
        reason: z.string().optional(),
      }),
    ),

  approveImport: oc
    .route({ method: "POST", path: "/imports/approve", tags: ["Clinical Records"] })
    .input(
      z.object({
        id: z.string().min(1),
        patientId: z.number().int().positive(),
        notes: z.string().optional(),
      }),
    )
    .output(z.object({ status: z.literal("ok") })),

  rejectImport: oc
    .route({ method: "POST", path: "/imports/reject", tags: ["Clinical Records"] })
    .input(
      z.object({
        id: z.string().min(1),
        notes: z.string().optional(),
      }),
    )
    .output(z.object({ status: z.literal("ok") })),

  listForPatient: oc
    .route({ method: "POST", path: "/by-patient", tags: ["Clinical Records"] })
    .input(z.object({ patientId: z.number().int().positive() }))
    .output(
      z.object({
        records: z.array(clinicalRecordSchema),
      }),
    ),
};

export type ClinicalRecordsContract = typeof clinicalRecordsContract;
