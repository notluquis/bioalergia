import { db } from "@finanzas/db";
import {
  clinicalRecordAnalyticsSchema,
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
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logAuditFromContext } from "../lib/audit-log.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  approveClinicalRecordImport,
  createPatientFromImport,
  approveClinicalRecordImports,
  rejectClinicalRecordImport,
  rejectClinicalRecordImports,
  reprocessClinicalRecordImport,
} from "../services/clinical-record-imports.ts";
import {
  getClinicalRecordAutoApproveJobType,
  getClinicalRecordBulkJobType,
  startAutoApproveHighConfidenceJob,
  startBulkClinicalRecordReprocessJob,
} from "../services/clinical-record-bulk.ts";
import { getClinicalRecordAnalytics } from "../services/clinical-record-analytics.ts";
import { cancelJob, getActiveJobsByType, getJobStatus, type JobState } from "../lib/jobQueue.ts";
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
      const search = input.search?.trim();
      const where = {
        ...(input.status ? { status: input.status } : {}),
        ...(search ? { filename: { contains: search, mode: "insensitive" as const } } : {}),
      };
      const [rows, total] = await Promise.all([
        db.clinicalRecordImport.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: offset,
          take: input.pageSize,
        }),
        db.clinicalRecordImport.count({ where }),
      ]);
      return {
        items: rows.map((row) => rowToImport(row as unknown as Record<string, unknown>)),
        page: input.page,
        pageSize: input.pageSize,
        total,
      };
    }),

  getImport: readClinicalRecords
    .route({ method: "POST", path: "/imports/get", tags: ["Clinical Records"] })
    .input(z.object({ id: z.string().min(1) }))
    .output(clinicalRecordImportSchema)
    .handler(async ({ input }) => {
      const row = await db.clinicalRecordImport.findUnique({ where: { id: input.id } });
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Import no encontrado" });
      return rowToImport(row as unknown as Record<string, unknown>);
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

  createPatientFromImport: updateClinicalRecords
    .route({ method: "POST", path: "/imports/create-patient", tags: ["Clinical Records"] })
    .input(
      z.object({
        id: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .output(z.object({ status: z.literal("ok"), patientId: z.number().int() }))
    .handler(async ({ input, context }) => {
      const { patientId } = await createPatientFromImport(input.id, context.user.id, input.notes);
      return { status: "ok" as const, patientId };
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
    .handler(async ({ context, input }) => {
      // $qb (Kysely) tipado: aliases 'cr' (ClinicalRecord) / 'cs' (ClinicalSeries).
      // to_char(consult_date) + `DESC NULLS LAST` se mantienen como fragmentos
      // sql crudos (snake_case físico) porque el ORM orderBy no expone control
      // de nulls; el resto (join, where, select) es builder tipado.
      const rows = await db.$qb
        .selectFrom("ClinicalRecord as cr")
        .innerJoin("ClinicalSeries as cs", "cs.id", "cr.clinicalSeriesId")
        .where("cs.patientId", "=", input.patientId)
        .where("cs.kind", "=", "MEDICAL_CONSULTATION")
        .select([
          "cr.id",
          "cr.clinicalSeriesId as clinicalSeriesId",
          "cr.sourceImportId as sourceImportId",
          sql<string | null>`to_char(cr.consult_date, 'YYYY-MM-DD')`.as("consultDate"),
          "cr.patientName as patientName",
          "cr.ageLabel as ageLabel",
          "cr.history",
          "cr.physicalExam as physicalExam",
          "cr.diagnosis",
          "cr.indications",
          "cr.antecedents",
          "cr.medications",
          "cr.knownAllergies as knownAllergies",
          "cr.observations",
          "cr.weightKg as weightKg",
          "cr.heightCm as heightCm",
          "cr.headCircumferenceCm as headCircumferenceCm",
          "cr.anthropometric",
          "cr.rawHeader as rawHeader",
          "cr.createdAt as createdAt",
          "cr.updatedAt as updatedAt",
        ])
        .orderBy(sql`cr.consult_date desc nulls last`)
        .orderBy("cr.createdAt", "desc")
        .execute();
      // Ficha access log — full clinical records (richest PHI: history,
      // diagnosis, medications). Decreto 41/2012 art. 9.
      void logAuditFromContext(context.hono, {
        kind: "CLINICAL_RECORD_READ",
        userId: context.user.id,
        actorLabel: context.user.email,
        resource: "Patient",
        resourceId: input.patientId,
        message: "ficha:clinical-records",
      });
      return {
        records: (rows as unknown as Record<string, unknown>[]).map((row) => ({
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
          antecedents: (row.antecedents as { personal: string[]; family: string[] } | null) ?? null,
          medications: (row.medications as string[] | null) ?? [],
          knownAllergies: (row.knownAllergies as string[] | null) ?? [],
          observations: (row.observations as string | null) ?? null,
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
      // Surface whichever queue job is running so the UI can resume on mount.
      const active =
        getActiveJobsByType(getClinicalRecordBulkJobType())[0] ??
        getActiveJobsByType(getClinicalRecordAutoApproveJobType())[0] ??
        null;
      return { job: jobToOutput(active) };
    }),

  approveImports: updateClinicalRecords
    .route({ method: "POST", path: "/imports/approve-many", tags: ["Clinical Records"] })
    .input(
      z.object({
        items: z
          .array(z.object({ id: z.string().min(1), patientId: z.number().int().positive() }))
          .min(1)
          .max(200),
        notes: z.string().optional(),
      })
    )
    .output(
      z.object({
        approved: z.number().int(),
        errors: z.array(z.object({ id: z.string(), message: z.string() })),
      })
    )
    .handler(async ({ input, context }) => {
      return approveClinicalRecordImports(input.items, context.user.id, input.notes);
    }),

  rejectImports: updateClinicalRecords
    .route({ method: "POST", path: "/imports/reject-many", tags: ["Clinical Records"] })
    .input(
      z.object({ ids: z.array(z.string().min(1)).min(1).max(200), notes: z.string().optional() })
    )
    .output(z.object({ rejected: z.number().int() }))
    .handler(async ({ input, context }) => {
      return rejectClinicalRecordImports(input.ids, context.user.id, input.notes);
    }),

  startAutoApprove: updateClinicalRecords
    .route({ method: "POST", path: "/imports/auto-approve/start", tags: ["Clinical Records"] })
    .input(z.object({ minScore: z.number().min(0).max(1).default(0.9) }))
    .output(z.object({ jobId: z.string() }))
    .handler(async ({ input, context }) => {
      const jobId = startAutoApproveHighConfidenceJob({
        minScore: input.minScore,
        reviewedBy: context.user.id,
        trigger: "intranet",
      });
      return { jobId };
    }),

  analytics: readClinicalRecords
    .route({ method: "POST", path: "/analytics", tags: ["Clinical Records"] })
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }))
    .output(clinicalRecordAnalyticsSchema)
    .handler(async ({ input }) => {
      return getClinicalRecordAnalytics({ dateFrom: input.dateFrom, dateTo: input.dateTo });
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
