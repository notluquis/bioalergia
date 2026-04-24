import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  oneDriveAuthUrlInputSchema,
  oneDriveCallbackInputSchema,
  oneDriveDisconnectOutputSchema,
  oneDriveFolderInputSchema,
  oneDriveStatusOutputSchema,
  skinTestImportActionInputSchema,
  skinTestImportListInputSchema,
  skinTestImportListOutputSchema,
  skinTestImportSchema,
  skinTestJobStatusInputSchema,
  skinTestJobStatusOutputSchema,
  skinTestsBySeriesInputSchema,
  skinTestsBySeriesOutputSchema,
  skinTestSyncInputSchema,
  skinTestSyncOutputSchema,
} from "@finanzas/orpc-contracts/clinical-skin-tests";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { startClinicalSkinTestImportJob } from "../lib/clinical-skin-tests/clinical-skin-test-scheduler";
import { getJobStatus } from "../lib/jobQueue";
import {
  connectOneDriveWithCode,
  disconnectOneDrive,
  getOneDriveAuthUrl,
  getOneDriveStatus,
  setOneDriveFolderPath,
} from "../lib/microsoft/onedrive";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  approveSkinTestImport,
  getSkinTestImport,
  listSkinTestImports,
  listSkinTestsBySeries,
  rejectSkinTestImport,
  reprocessSkinTestImport,
} from "../services/clinical-skin-test-imports";
import { SuperJSONRPCHandler } from "./superjson";

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
  approveImport: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/{id}/approve" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema)
    .handler(async ({ input, context }: { input: z.input<typeof skinTestImportActionInputSchema>; context: { user: { id: number } } }) => {
      return await approveSkinTestImport(input.id, context.user.id, input.notes);
    }),

  configureOneDriveFolder: updateClinicalSkinTests
    .route({ method: "POST", path: "/onedrive/folder" })
    .input(oneDriveFolderInputSchema)
    .output(oneDriveStatusOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveFolderInputSchema> }) => {
      await setOneDriveFolderPath(input.folderPath);
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
    .input(z.object({}))
    .output(oneDriveDisconnectOutputSchema)
    .handler(async () => {
      await disconnectOneDrive();
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

  rejectImport: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/{id}/reject" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema)
    .handler(async ({ input, context }: { input: z.input<typeof skinTestImportActionInputSchema>; context: { user: { id: number } } }) => {
      return await rejectSkinTestImport(input.id, context.user.id, input.notes);
    }),

  reprocessImport: updateClinicalSkinTests
    .route({ method: "POST", path: "/imports/{id}/reprocess" })
    .input(skinTestImportActionInputSchema)
    .output(skinTestImportSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestImportActionInputSchema> }) => {
      return await reprocessSkinTestImport(input.id);
    }),

  sync: updateClinicalSkinTests
    .route({ method: "POST", path: "/sync" })
    .input(skinTestSyncInputSchema)
    .output(skinTestSyncOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof skinTestSyncInputSchema> }) => {
      return {
        jobId: await startClinicalSkinTestImportJob({
          folderPath: input.folderPath,
          force: input.force,
          trigger: "manual",
        }),
      };
    }),
};

function defaultRedirectUri() {
  return process.env.MICROSOFT_OAUTH_REDIRECT_URI ||
    `${process.env.PUBLIC_URL || "http://localhost:3000"}/api/orpc/clinical-skin-tests/oauth/callback`;
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
