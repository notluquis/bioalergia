import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import {
  oneDriveAuthUrlInputSchema,
  oneDriveCallbackInputSchema,
  oneDriveDisconnectInputSchema,
  oneDriveDisconnectOutputSchema,
  oneDriveFolderChildrenInputSchema,
  oneDriveFolderChildrenOutputSchema,
  oneDriveFolderInputSchema,
  oneDriveArchiveInputSchema,
  oneDriveFolderPreviewInputSchema,
  oneDriveFolderPreviewOutputSchema,
  oneDriveJobStatusSchema,
  oneDriveStatusOutputSchema,
} from "@finanzas/orpc-contracts/onedrive";
import { onError, ORPCError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { cancelJob, getActiveJobsByType, getJobStatus, type JobState } from "../lib/jobQueue.ts";
import { logError } from "../lib/logger.ts";
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
import {
  getOneDriveArchiveJobType,
  startArchiveXlsxSnapshotsJob,
} from "../services/onedrive-archive.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

// Generic OneDrive account / folder / webhook management router. Extracted
// from the skin-test router so any clinical feature can drive it. Thin
// handlers over the feature-agnostic lib/microsoft/onedrive.ts.

configureSuperjson();

type OneDriveORPCContext = {
  hono: HonoContext;
};

const base = os.$context<OneDriveORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

const readOneDrive = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "ClinicalSeries");
  if (!canRead) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

const manageOneDrive = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "ClinicalSeries");
  if (!canUpdate) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  return next();
});

// Kept identical to the original skin-test default so the Azure AD app's
// registered redirect URI keeps matching during the token exchange.
function defaultRedirectUri() {
  return (
    process.env.MICROSOFT_OAUTH_REDIRECT_URI ||
    `${process.env.PUBLIC_URL || "http://localhost:3000"}/api/orpc/clinical-skin-tests/oauth/callback`
  );
}

const routerBase = {
  getOneDriveStatus: readOneDrive
    .route({ method: "GET", path: "/status" })
    .input(z.object({}))
    .output(oneDriveStatusOutputSchema)
    .handler(async () => await getOneDriveStatus()),

  getOneDriveAuthUrl: manageOneDrive
    .route({ method: "GET", path: "/auth-url" })
    .input(oneDriveAuthUrlInputSchema)
    .output(z.object({ url: z.string() }))
    .handler(({ input }: { input: z.input<typeof oneDriveAuthUrlInputSchema> }) => {
      return { url: getOneDriveAuthUrl(input.redirectUri ?? defaultRedirectUri()) };
    }),

  connectOneDrive: manageOneDrive
    .route({ method: "POST", path: "/callback" })
    .input(oneDriveCallbackInputSchema)
    .output(oneDriveStatusOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveCallbackInputSchema> }) => {
      await connectOneDriveWithCode(input.code, input.redirectUri ?? defaultRedirectUri());
      return await getOneDriveStatus();
    }),

  disconnectOneDrive: manageOneDrive
    .route({ method: "POST", path: "/disconnect" })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveDisconnectOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveDisconnectInputSchema> }) => {
      await disconnectOneDrive(input.accountId);
      return { connected: false };
    }),

  configureOneDriveFolder: manageOneDrive
    .route({ method: "POST", path: "/folder" })
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

  listOneDriveFolderChildren: readOneDrive
    .route({ method: "GET", path: "/folders" })
    .input(oneDriveFolderChildrenInputSchema)
    .output(oneDriveFolderChildrenOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveFolderChildrenInputSchema> }) => {
      return await listOneDriveFolderChildren(input.accountId, {
        driveId: input.driveId,
        itemId: input.itemId,
      });
    }),

  folderPreview: readOneDrive
    .route({ method: "GET", path: "/folder-preview" })
    .input(oneDriveFolderPreviewInputSchema)
    .output(oneDriveFolderPreviewOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveFolderPreviewInputSchema> }) => {
      return await getOneDriveFolderPreview(input.accountId, {
        driveId: input.driveId,
        itemId: input.itemId,
      });
    }),

  renewOneDriveSubscription: manageOneDrive
    .route({ method: "POST", path: "/subscription/renew" })
    .input(oneDriveDisconnectInputSchema)
    .output(oneDriveStatusOutputSchema)
    .handler(async ({ input }: { input: z.input<typeof oneDriveDisconnectInputSchema> }) => {
      await renewOneDriveSubscriptionNow(input.accountId);
      return await getOneDriveStatus();
    }),

  archiveSnapshots: manageOneDrive
    .route({ method: "POST", path: "/snapshots/archive" })
    .input(oneDriveArchiveInputSchema)
    .output(z.object({ jobId: z.string() }))
    .handler(async ({ input }: { input: z.input<typeof oneDriveArchiveInputSchema> }) => {
      const jobId = startArchiveXlsxSnapshotsJob({
        classification: input.classification,
        accountId: input.accountId,
        force: input.force,
        trigger: "intranet",
      });
      return { jobId };
    }),

  getArchiveJob: readOneDrive
    .route({ method: "POST", path: "/snapshots/archive/status" })
    .input(z.object({ jobId: z.string().min(1) }))
    .output(z.object({ job: oneDriveJobStatusSchema.nullable() }))
    .handler(({ input }: { input: { jobId: string } }) => {
      return { job: jobToOutput(getJobStatus(input.jobId)) };
    }),

  getActiveArchiveJob: readOneDrive
    .route({ method: "POST", path: "/snapshots/archive/active" })
    .input(z.object({}))
    .output(z.object({ job: oneDriveJobStatusSchema.nullable() }))
    .handler(() => {
      return { job: jobToOutput(getActiveJobsByType(getOneDriveArchiveJobType())[0] ?? null) };
    }),

  cancelArchiveJob: manageOneDrive
    .route({ method: "POST", path: "/snapshots/archive/cancel" })
    .input(z.object({ jobId: z.string().min(1) }))
    .output(z.object({ cancelled: z.boolean() }))
    .handler(({ input }: { input: { jobId: string } }) => {
      return { cancelled: cancelJob(input.jobId) };
    }),
};

function jobToOutput(j: JobState | null) {
  if (!j) return null;
  const result =
    j.result && typeof j.result === "object"
      ? (j.result as { processed?: number; archived?: number; errors?: number })
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
          archived: result.archived ?? 0,
          errors: result.errors ?? 0,
        }
      : null,
    error: j.error,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
  };
}

export const onedriveORPCRouter = base.prefix("/api/orpc/onedrive").router(routerBase);

export const onedriveORPCHandler = new SuperJSONRPCHandler(onedriveORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.onedrive" });
    }),
  ],
});

export const onedriveOpenAPIHandler = new OpenAPIHandler(onedriveORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia OneDrive oRPC",
          description: "Gestión genérica de cuentas, carpetas y webhooks de OneDrive / Microsoft Graph.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.onedrive" });
    }),
  ],
});

export type OneDriveORPCRouter = typeof onedriveORPCRouter;
