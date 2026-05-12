import { db, kysely } from "@finanzas/db";
import {
  clinicalRecordImportSchema,
  clinicalRecordImportStatusSchema,
  clinicalRecordJobStatusSchema,
  clinicalRecordSchema,
} from "@finanzas/orpc-contracts/clinical-records";
import { onError, ORPCError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import type { Context as HonoContext } from "hono";
import { sql } from "kysely";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  approveClinicalRecordImport,
  rejectClinicalRecordImport,
  reprocessClinicalRecordImport,
} from "../services/clinical-record-imports.ts";
import {
  getClinicalRecordBulkJobType,
  startBulkClinicalRecordReprocessJob,
} from "../services/clinical-record-bulk.ts";
import {
  cancelJob,
  getActiveJobsByType,
  getJobStatus,
  type JobState,
} from "../lib/jobQueue.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ClinicalRecordsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ClinicalRecordsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

const readClinicalRecords = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "ClinicalSeries");
  if (!canRead) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const updateClinicalRecords = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "ClinicalSeries");
  if (!canUpdate) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

function rowToImport(row: Record<string, unknown>): z.infer<typeof clinicalRecordImportSchema> {
  return {
    id: String(row.id),
    filename: String(row.filename ?? ""),
    status: row.status as z.infer<typeof clinicalRecordImportStatusSchema>,
    parserVersion: String(row.parserVersion ?? ""),
    confidence: Number(row.confidence ?? 0),
    error: (row.error as string | null) ?? null,
    issues:
      (row.issues as Array<{
        code: string;
        message: string;
        severity: "info" | "warning" | "error";
      }> | null) ?? [],
    parsedPayload:
      (row.parsedPayload as z.infer<typeof clinicalRecordImportSchema>["parsedPayload"]) ?? null,
    matchedPatientId: (row.matchedPatientId as number | null) ?? null,
    matchedClinicalSeriesId: (row.matchedClinicalSeriesId as number | null) ?? null,
    matchCandidates:
      (row.matchCandidates as z.infer<typeof clinicalRecordImportSchema>["matchCandidates"]) ?? [],
    reviewedBy: (row.reviewedBy as number | null) ?? null,
    reviewedAt: (row.reviewedAt as Date | null) ?? null,
    reviewNotes: (row.reviewNotes as string | null) ?? null,
    importedAt: (row.importedAt as Date | null) ?? null,
    oneDriveAccountId: (row.oneDriveAccountId as string | null) ?? null,
    oneDriveItemId: String(row.oneDriveItemId ?? ""),
    oneDriveWebUrl: (row.oneDriveWebUrl as string | null) ?? null,
    modifiedAt: (row.modifiedAt as Date | null) ?? null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

const routerBase = {
  listImports: readClinicalRecords
    .route({ method: "POST", path: "/imports/list", tags: ["Clinical Records"] })
    .input(
      z.object({
        status: clinicalRecordImportStatusSchema.optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(200).default(50),
        search: z.string().optional(),
      })
    )
    .output(
      z.object({
        items: z.array(clinicalRecordImportSchema),
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
      })
    )
    .handler(async ({ input }) => {
      const offset = (input.page - 1) * input.pageSize;
      const status = input.status ?? null;
      const search = input.search?.trim() ?? null;
      const where = sql.join(
        [
          status ? sql`status = ${status}::"ClinicalRecordImportStatus"` : null,
          search ? sql`filename ILIKE ${`%${search}%`}` : null,
        ].filter(Boolean) as ReturnType<typeof sql>[],
        sql` AND `
      );
      const whereClause = status || search ? sql`WHERE ${where}` : sql``;
      const rows = await sql<Record<string, unknown>>`
        SELECT
          id, filename, status::text AS status,
          parser_version       AS "parserVersion",
          confidence,
          error,
          issues,
          parsed_payload       AS "parsedPayload",
          matched_patient_id   AS "matchedPatientId",
          matched_clinical_series_id AS "matchedClinicalSeriesId",
          match_candidates     AS "matchCandidates",
          reviewed_by          AS "reviewedBy",
          reviewed_at          AS "reviewedAt",
          review_notes         AS "reviewNotes",
          imported_at          AS "importedAt",
          onedrive_account_id  AS "oneDriveAccountId",
          onedrive_item_id     AS "oneDriveItemId",
          onedrive_web_url     AS "oneDriveWebUrl",
          modified_at          AS "modifiedAt",
          created_at           AS "createdAt",
          updated_at           AS "updatedAt"
        FROM clinical_record_imports
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${input.pageSize}
        OFFSET ${offset}
      `.execute(kysely);
      const total = await sql<{ c: string }>`
        SELECT COUNT(*)::text AS c FROM clinical_record_imports ${whereClause}
      `.execute(kysely);
      return {
        items: rows.rows.map(rowToImport),
        page: input.page,
        pageSize: input.pageSize,
        total: Number.parseInt(total.rows[0]?.c ?? "0", 10),
      };
    }),

  getImport: readClinicalRecords
    .route({ method: "POST", path: "/imports/get", tags: ["Clinical Records"] })
    .input(z.object({ id: z.string().min(1) }))
    .output(clinicalRecordImportSchema)
    .handler(async ({ input }) => {
      const r = await sql<Record<string, unknown>>`
        SELECT
          id, filename, status::text AS status,
          parser_version       AS "parserVersion",
          confidence, error, issues,
          parsed_payload       AS "parsedPayload",
          matched_patient_id   AS "matchedPatientId",
          matched_clinical_series_id AS "matchedClinicalSeriesId",
          match_candidates     AS "matchCandidates",
          reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt", review_notes AS "reviewNotes",
          imported_at AS "importedAt",
          onedrive_account_id AS "oneDriveAccountId",
          onedrive_item_id    AS "oneDriveItemId",
          onedrive_web_url    AS "oneDriveWebUrl",
          modified_at         AS "modifiedAt",
          created_at AS "createdAt", updated_at AS "updatedAt"
        FROM clinical_record_imports WHERE id = ${input.id}
      `.execute(kysely);
      const row = r.rows[0];
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Import no encontrado" });
      return rowToImport(row);
    }),

  reprocessImport: updateClinicalRecords
    .route({ method: "POST", path: "/imports/reprocess", tags: ["Clinical Records"] })
    .input(z.object({ id: z.string().min(1) }))
    .output(
      z.object({
        status: clinicalRecordImportStatusSchema,
        candidates: z.number().int().optional(),
        reason: z.string().optional(),
      })
    )
    .handler(async ({ input }) => {
      const result = await reprocessClinicalRecordImport(input.id);
      return result;
    }),

  approveImport: updateClinicalRecords
    .route({ method: "POST", path: "/imports/approve", tags: ["Clinical Records"] })
    .input(
      z.object({
        id: z.string().min(1),
        patientId: z.number().int().positive(),
        notes: z.string().optional(),
      })
    )
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input, context }) => {
      await approveClinicalRecordImport(input.id, input.patientId, context.user.id, input.notes);
      return { status: "ok" as const };
    }),

  rejectImport: updateClinicalRecords
    .route({ method: "POST", path: "/imports/reject", tags: ["Clinical Records"] })
    .input(z.object({ id: z.string().min(1), notes: z.string().optional() }))
    .output(z.object({ status: z.literal("ok") }))
    .handler(async ({ input, context }) => {
      await rejectClinicalRecordImport(input.id, context.user.id, input.notes);
      return { status: "ok" as const };
    }),

  listForPatient: readClinicalRecords
    .route({ method: "POST", path: "/by-patient", tags: ["Clinical Records"] })
    .input(z.object({ patientId: z.number().int().positive() }))
    .output(z.object({ records: z.array(clinicalRecordSchema) }))
    .handler(async ({ input }) => {
      const r = await sql<Record<string, unknown>>`
        SELECT
          cr.id,
          cr.clinical_series_id   AS "clinicalSeriesId",
          cr.source_import_id     AS "sourceImportId",
          to_char(cr.consult_date, 'YYYY-MM-DD') AS "consultDate",
          cr.patient_name         AS "patientName",
          cr.age_label            AS "ageLabel",
          cr.history,
          cr.physical_exam        AS "physicalExam",
          cr.diagnosis,
          cr.indications,
          cr.weight_kg            AS "weightKg",
          cr.height_cm            AS "heightCm",
          cr.head_circumference_cm AS "headCircumferenceCm",
          cr.anthropometric,
          cr.raw_header           AS "rawHeader",
          cr.created_at           AS "createdAt",
          cr.updated_at           AS "updatedAt"
        FROM clinical_records cr
        JOIN clinical_series cs ON cs.id = cr.clinical_series_id
        WHERE cs.patient_id = ${input.patientId}
          AND cs.kind = 'MEDICAL_CONSULTATION'
        ORDER BY cr.consult_date DESC NULLS LAST, cr.created_at DESC
      `.execute(kysely);
      return {
        records: r.rows.map((row) => ({
          id: String(row.id),
          clinicalSeriesId: Number(row.clinicalSeriesId),
          sourceImportId: String(row.sourceImportId),
          consultDate: (row.consultDate as string | null) ?? null,
          patientName: (row.patientName as string | null) ?? null,
          ageLabel: (row.ageLabel as string | null) ?? null,
          history: (row.history as string | null) ?? null,
          physicalExam: (row.physicalExam as string | null) ?? null,
          diagnosis: (row.diagnosis as string | null) ?? null,
          indications: (row.indications as string[] | null) ?? [],
          weightKg: row.weightKg == null ? null : Number(row.weightKg),
          heightCm: row.heightCm == null ? null : Number(row.heightCm),
          headCircumferenceCm:
            row.headCircumferenceCm == null ? null : Number(row.headCircumferenceCm),
          anthropometric: (row.anthropometric as Record<string, string> | null) ?? {},
          rawHeader: (row.rawHeader as Record<string, unknown> | null) ?? {},
          createdAt: row.createdAt as Date,
          updatedAt: row.updatedAt as Date,
        })),
      };
    }),

  startBulkReprocess: updateClinicalRecords
    .route({
      method: "POST",
      path: "/imports/bulk-reprocess/start",
      tags: ["Clinical Records"],
    })
    .input(z.object({ maxImports: z.number().int().positive().optional() }))
    .output(z.object({ jobId: z.string() }))
    .handler(async ({ input }) => {
      const jobId = startBulkClinicalRecordReprocessJob({
        trigger: "intranet",
        maxImports: input.maxImports,
      });
      return { jobId };
    }),

  getBulkJob: readClinicalRecords
    .route({
      method: "POST",
      path: "/imports/bulk-reprocess/status",
      tags: ["Clinical Records"],
    })
    .input(z.object({ jobId: z.string().min(1) }))
    .output(z.object({ job: clinicalRecordJobStatusSchema.nullable() }))
    .handler(async ({ input }) => {
      const j = getJobStatus(input.jobId);
      return { job: jobToOutput(j) };
    }),

  cancelBulkJob: updateClinicalRecords
    .route({
      method: "POST",
      path: "/imports/bulk-reprocess/cancel",
      tags: ["Clinical Records"],
    })
    .input(z.object({ jobId: z.string().min(1) }))
    .output(z.object({ cancelled: z.boolean() }))
    .handler(async ({ input }) => {
      const ok = cancelJob(input.jobId);
      return { cancelled: ok };
    }),

  getActiveBulkJob: readClinicalRecords
    .route({
      method: "POST",
      path: "/imports/bulk-reprocess/active",
      tags: ["Clinical Records"],
    })
    .input(z.object({}))
    .output(z.object({ job: clinicalRecordJobStatusSchema.nullable() }))
    .handler(async () => {
      const active = getActiveJobsByType(getClinicalRecordBulkJobType());
      return { job: jobToOutput(active[0] ?? null) };
    }),
};

function jobToOutput(j: JobState | null) {
  if (!j) return null;
  const result =
    j.result && typeof j.result === "object"
      ? (j.result as { processed?: number; imported?: number; pending?: number; errors?: number })
      : null;
  return {
    id: j.id,
    type: j.type,
    status: j.status,
    progress: j.progress,
    total: j.total,
    message: j.message,
    meta: j.meta,
    result: result
      ? {
          processed: result.processed ?? 0,
          imported: result.imported ?? 0,
          pending: result.pending ?? 0,
          errors: result.errors ?? 0,
        }
      : null,
    error: j.error,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

void db;

export const clinicalRecordsORPCRouter = base
  .prefix("/api/orpc/clinical-records")
  .router(routerBase);

export const clinicalRecordsORPCHandler = new SuperJSONRPCHandler(clinicalRecordsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.clinical-records" });
    }),
  ],
});

export const clinicalRecordsOpenAPIHandler = new OpenAPIHandler(clinicalRecordsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Clinical Records oRPC",
          description: "Fichas clínicas — read + review",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.clinical-records" });
    }),
  ],
});

export type ClinicalRecordsORPCRouter = typeof clinicalRecordsORPCRouter;
