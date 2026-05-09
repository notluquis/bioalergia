import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  clinicalDocumentsBySeriesOutputSchema,
  oneDriveAuthUrlInputSchema,
  oneDriveCallbackInputSchema,
  oneDriveDisconnectInputSchema,
  oneDriveDisconnectOutputSchema,
  oneDriveFolderChildrenInputSchema,
  oneDriveFolderChildrenOutputSchema,
  oneDriveFolderInputSchema,
  oneDriveFolderPreviewInputSchema,
  oneDriveFolderPreviewOutputSchema,
  oneDriveStatusOutputSchema,
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
import { getSessionUser, hasPermission } from "../auth.ts";
import {
  startClinicalSkinTestArchiveSnapshotsJob,
  startClinicalSkinTestImportJob,
  startClinicalSkinTestProcessDiscoveredJob,
  startClinicalSkinTestReprocessPendingJob,
  startClinicalXlsxLibraryReclassifyJob,
} from "../lib/clinical-skin-tests/clinical-skin-test-scheduler.ts";
import { cancelJob, getActiveJobsByType, getJobStatus } from "../lib/jobQueue.ts";
import {
  connectOneDriveWithCode,
  disconnectOneDrive,
  getOneDriveAuthUrl,
  getOneDriveFolderPreview,
  getOneDriveStatus,
  listOneDriveFolderChildren,
  renewOneDriveSubscriptionNow,
  setOneDriveFolderPath,
} from "../lib/microsoft/onedrive.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  approveSkinTestImport,
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

  configureOneDriveFolder: updateClinicalSkinTests
    .route({ method: "POST", path: "/onedrive/folder" })
    .input(oneDriveFolderInputSchema)
    .output(oneDriveStatusOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveFolderInputSchema> }) => {
      await setOneDriveFolderPath(input.accountId, {
        driveId: input.driveId,
        folderPath: input.folderPath,
        itemId: input.itemId,
        name: input.name,
      });
      return await getOneDriveStatus();
    }),

  listOneDriveFolderChildren: readClinicalSkinTests
    .route({ method: "GET", path: "/onedrive/folders" })
    .input(oneDriveFolderChildrenInputSchema)
    .output(oneDriveFolderChildrenOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveFolderChildrenInputSchema> }) => {
      return await listOneDriveFolderChildren(input.accountId, {
        driveId: input.driveId,
        itemId: input.itemId,
      });
    }),

  folderPreview: readClinicalSkinTests
    .route({ method: "GET", path: "/onedrive/folder-preview" })
    .input(oneDriveFolderPreviewInputSchema)
    .output(oneDriveFolderPreviewOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveFolderPreviewInputSchema> }) => {
      return await getOneDriveFolderPreview(input.accountId, {
        driveId: input.driveId,
        itemId: input.itemId,
      });
    }),

  renewOneDriveSubscription: updateClinicalSkinTests
    .route({ method: "POST", path: "/onedrive/subscription/renew" })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveStatusOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveDisconnectInputSchema> }) => {
      await renewOneDriveSubscriptionNow(input.accountId);
      return await getOneDriveStatus();
    }),

  connectOneDrive: updateClinicalSkinTests
    .route({ method: "POST", path: "/onedrive/callback" })
    .input(oneDriveCallbackInputSchema)
    .output(oneDriveStatusOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveCallbackInputSchema> }) => {
      await connectOneDriveWithCode(input.code, input.redirectUri ?? defaultRedirectUri());
      return await getOneDriveStatus();
    }),

  disconnectOneDrive: updateClinicalSkinTests
    .route({ method: "POST", path: "/onedrive/disconnect" })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveDisconnectOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveDisconnectInputSchema> }) => {
      await disconnectOneDrive(input.accountId);
      return { connected: false };
    }),

  getOneDriveAuthUrl: updateClinicalSkinTests
    .route({ method: "GET", path: "/onedrive/auth-url" })
    .input(oneDriveAuthUrlInputSchema)
    .output(z.object({ url: z.string() }))
    .handler(({ input }: { input: z.input<typeof oneDriveAuthUrlInputSchema> }) => {
      return { url: getOneDriveAuthUrl(input.redirectUri ?? defaultRedirectUri()) };
    }),

  getOneDriveStatus: readClinicalSkinTests
    .route({ method: "GET", path: "/onedrive/status" })
    .input(z.object({}))
    .output(oneDriveStatusOutputSchema)
    .handler(async () => await getOneDriveStatus()),

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

function defaultRedirectUri() {
  return (
    process.env.MICROSOFT_OAUTH_REDIRECT_URI ||
    `${process.env.PUBLIC_URL || "http://localhost:3000"}/api/orpc/clinical-skin-tests/oauth/callback`
  );
}

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
