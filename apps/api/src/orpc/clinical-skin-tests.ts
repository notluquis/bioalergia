import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  clinicalDocumentsBySeriesOutputSchema,
  skinTestAnalyticsInputSchema,
  skinTestAnalyticsOutputSchema,
  skinTestArchiveSnapshotsInputSchema,
  skinTestImportActionInputSchema,
  skinTestBulkImportActionInputSchema,
  skinTestBulkImportActionOutputSchema,
  skinTestActiveJobInputSchema,
  skinTestActiveJobOutputSchema,
  skinTestImportListInputSchema,
  skinTestImportListOutputSchema,
  skinTestImportSchema,
  skinTestJobCancelInputSchema,
  skinTestJobCancelOutputSchema,
  skinTestJobStatusInputSchema,
  skinTestJobStatusOutputSchema,
  skinTestProcessDiscoveredInputSchema,
  skinTestReprocessPendingInputSchema,
  skinTestsBySeriesInputSchema,
  skinTestsBySeriesOutputSchema,
  skinTestSyncInputSchema,
  skinTestSyncOutputSchema,
} from "@finanzas/orpc-contracts/clinical-skin-tests";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import {
  startClinicalSkinTestArchiveSnapshotsJob,
  startClinicalSkinTestImportJob,
  startClinicalSkinTestProcessDiscoveredJob,
  startClinicalSkinTestReconcileStaleJob,
  startClinicalSkinTestReprocessPendingJob,
  startClinicalXlsxLibraryReclassifyJob,
} from "../services/clinical-skin-test-scheduler.ts";
import { cancelJob, getActiveJobsByType, getJobStatus } from "../lib/jobQueue.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  approveSkinTestImport,
  countStaleClinicalDocumentImports,
  countStaleSkinTestImports,
  getSkinTestAnalytics,
  getSkinTestImportJobType,
  getSkinTestImport,
  listClinicalDocumentsBySeries,
  listSkinTestImports,
  listSkinTestsBySeries,
  processSkinTestImports,
  rejectSkinTestImport,
  reprocessSkinTestImport,
} from "../services/clinical-skin-test-imports.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ClinicalSkinTestsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<ClinicalSkinTestsORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }
  return next({ context: { ...context, user } });
});

const readClinicalSkinTests = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "ClinicalSeries");
  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const updateClinicalSkinTests = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "ClinicalSeries");
  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }
  return next();
});

const routerBase = {
  analytics: readClinicalSkinTests
    .route({ method: "GET", path: "/analytics" })
    .input(skinTestAnalyticsInputSchema)
    .output(skinTestAnalyticsOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestAnalyticsInputSchema> }) => {
      return await getSkinTestAnalytics(input);
    }),

  approveImport: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/{id}/approve" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.input<typeof skinTestImportActionInputSchema>;
        context: { user: { id: number } };
      }) => {
        return await approveSkinTestImport(input.id, context.user.id, input.notes);
      }
    ),

  importDetail: readClinicalSkinTests
    .route({ method: "GET", path: "/imports/{id}" })
    .input(z.object({ id: z.string() }))
    .output(skinTestImportSchema)
    .handler(async ({ input }: { input: { id: string } }) => await getSkinTestImport(input.id)),

  jobStatus: readClinicalSkinTests
    .route({ method: "GET", path: "/jobs/{jobId}" })
    .input(skinTestJobStatusInputSchema)
    .output(skinTestJobStatusOutputSchema)
    .handler(({ input }: { input: z.input<typeof skinTestJobStatusInputSchema> }) => {
      const job = getJobStatus(input.jobId);
      if (!job) throw new ORPCError("NOT_FOUND", { message: "Job not found or expired" });
      return { job };
    }),

  cancelJob: updateClinicalSkinTests
    .route({ method: "POST", path: "/jobs/{jobId}/cancel" })
    .input(skinTestJobCancelInputSchema)
    .output(skinTestJobCancelOutputSchema)
    .handler(({ input }: { input: z.input<typeof skinTestJobCancelInputSchema> }) => {
      const cancelled = cancelJob(input.jobId, "Sincronización cancelada por usuario");
      return {
        cancelled,
        job: getJobStatus(input.jobId),
      };
    }),

  activeJob: readClinicalSkinTests
    .route({ method: "GET", path: "/jobs/active" })
    .input(skinTestActiveJobInputSchema)
    .output(skinTestActiveJobOutputSchema)
    .handler(() => {
      const [job] = getActiveJobsByType(getSkinTestImportJobType());
      return { job: job ?? null };
    }),

  listImports: readClinicalSkinTests
    .route({ method: "GET", path: "/imports" })
    .input(skinTestImportListInputSchema)
    .output(skinTestImportListOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestImportListInputSchema> }) => {
      return await listSkinTestImports(input);
    }),

  listTestsBySeries: readClinicalSkinTests
    .route({ method: "GET", path: "/series/{clinicalSeriesId}/tests" })
    .input(skinTestsBySeriesInputSchema)
    .output(skinTestsBySeriesOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestsBySeriesInputSchema> }) => {
      return await listSkinTestsBySeries(input.clinicalSeriesId);
    }),

  listDocumentsBySeries: readClinicalSkinTests
    .route({ method: "GET", path: "/series/{clinicalSeriesId}/documents" })
    .input(skinTestsBySeriesInputSchema)
    .output(clinicalDocumentsBySeriesOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestsBySeriesInputSchema> }) => {
      return await listClinicalDocumentsBySeries(input.clinicalSeriesId);
    }),

  rejectImport: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/{id}/reject" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema)
    .handler(
      async ({
        input,
        context,
      }: {
        input: z.input<typeof skinTestImportActionInputSchema>;
        context: { user: { id: number } };
      }) => {
        return await rejectSkinTestImport(input.id, context.user.id, input.notes);
      }
    ),

  reprocessImport: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/{id}/reprocess" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestImportActionInputSchema> }) => {
      return await reprocessSkinTestImport(input.id);
    }),

  processImports: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/process" })
    .input(skinTestBulkImportActionInputSchema)
    .output(skinTestBulkImportActionOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestBulkImportActionInputSchema> }) => {
      return await processSkinTestImports(input.ids);
    }),

  processDiscoveredImports: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/process-discovered" })
    .input(skinTestProcessDiscoveredInputSchema)
    .output(skinTestSyncOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestProcessDiscoveredInputSchema> }) => {
      return {
        jobId: await startClinicalSkinTestProcessDiscoveredJob({
          query: input.query,
          trigger: "manual:process-discovered",
        }),
      };
    }),

  reprocessPendingImports: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/reprocess-pending" })
    .input(skinTestReprocessPendingInputSchema)
    .output(skinTestSyncOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestReprocessPendingInputSchema> }) => {
      return {
        jobId: await startClinicalSkinTestReprocessPendingJob({
          query: input.query,
          trigger: "manual:reprocess-pending",
        }),
      };
    }),

  reclassifyXlsxLibrary: updateClinicalSkinTests
    .route({ method: "POST", path: "/xlsx-library/reclassify" })
    .input(z.object({}))
    .output(skinTestSyncOutputSchema)
    .handler(async () => {
      return {
        jobId: await startClinicalXlsxLibraryReclassifyJob({
          trigger: "manual:reclassify-xlsx-library",
        }),
      };
    }),

  // Count of imports whose stored OneDrive metadata drifted from the library
  // (orphans of the rename/de-qualification bug) — drives the targeted button.
  staleImportsCount: readClinicalSkinTests
    .route({ method: "GET", path: "/imports/stale-count" })
    .input(z.object({}))
    .output(z.object({ count: z.number() }))
    .handler(async () => {
      // The single "Reconciliar" button heals both pipelines, so the badge counts both.
      const [skinTests, documents] = await Promise.all([
        countStaleSkinTestImports(),
        countStaleClinicalDocumentImports(),
      ]);
      return { count: skinTests + documents };
    }),

  // Targeted heal: reconcile ONLY the desynced imports (refresh metadata, requeue
  // still-importable ones, demote de-qualified ones). Idempotent. The existing
  // reprocess-pending button then re-parses the requeued rows.
  reconcileStaleImports: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/reconcile-stale" })
    .input(z.object({}))
    .output(skinTestSyncOutputSchema)
    .handler(async () => {
      return {
        jobId: await startClinicalSkinTestReconcileStaleJob({
          trigger: "manual:reconcile-stale",
        }),
      };
    }),

  archiveSnapshots: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/archive-snapshots" })
    .input(skinTestArchiveSnapshotsInputSchema)
    .output(skinTestSyncOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestArchiveSnapshotsInputSchema> }) => {
      return {
        jobId: await startClinicalSkinTestArchiveSnapshotsJob({
          accountId: input.accountId,
          dryRun: input.dryRun,
          importStatus: input.importStatus,
          limit: input.limit,
          onlyChanged: input.onlyChanged,
          onlyMissing: input.onlyMissing,
          query: input.query,
          trigger: "manual:archive-snapshots",
        }),
      };
    }),

  sync: updateClinicalSkinTests
    .route({ method: "POST", path: "/sync" })
    .input(skinTestSyncInputSchema)
    .output(skinTestSyncOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestSyncInputSchema> }) => {
      return {
        jobId: await startClinicalSkinTestImportJob({
          accountId: input.accountId,
          folderDriveId: input.folderDriveId,
          folderItemId: input.folderItemId,
          folderPath: input.folderPath,
          force: input.force,
          trigger: "manual",
        }),
      };
    }),
};

export const clinicalSkinTestsORPCRouter = base
  .prefix("/api/orpc/clinical-skin-tests")
  .router(routerBase);

export const clinicalSkinTestsORPCHandler = new SuperJSONRPCHandler(clinicalSkinTestsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.clinical-skin-tests",
      });
    }),
  ],
});

export const clinicalSkinTestsOpenAPIHandler = new OpenAPIHandler(clinicalSkinTestsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Clinical Skin Tests oRPC",
          description: "Importación y resultados de tests cutáneos desde OneDrive.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.clinical-skin-tests",
      });
    }),
  ],
});

export type ClinicalSkinTestsORPCRouter = typeof clinicalSkinTestsORPCRouter;
