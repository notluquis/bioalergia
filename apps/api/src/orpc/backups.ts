import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { isOAuthConfigured } from "../lib/google/google-core";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { getCurrentJobs, getJobHistory, getLogs, startBackup } from "../services/backups";
import { getBackupTables, listBackups } from "../services/drive";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type BackupsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<BackupsORPCContext>();

const backupFileSchema = z.object({
  createdTime: z.string(),
  customChecksum: z.string().optional(),
  id: z.string(),
  name: z.string(),
  size: z.string(),
  webViewLink: z.string().optional(),
});

const backupJobSchema = z.looseObject({
  completedAt: z.coerce.date().optional(),
  currentStep: z.string(),
  error: z.string().optional(),
  id: z.string(),
  progress: z.number(),
  result: z
    .object({
      driveFileId: z.string(),
      durationMs: z.number(),
      filename: z.string(),
      message: z.string().optional(),
      sizeBytes: z.number(),
      skipped: z.boolean().optional(),
      stats: z
        .record(
          z.string(),
          z.object({
            count: z.number(),
            hash: z.string(),
          }),
        )
        .optional(),
      tables: z.array(z.string()),
      webViewLink: z.string().optional(),
    })
    .optional(),
  startedAt: z.coerce.date(),
  status: z.enum(["completed", "failed", "pending", "running", "uploading"]),
  type: z.enum(["full", "scheduled"]),
});

const restoreJobSchema = z.looseObject({
  backupFileId: z.string(),
  completedAt: z.coerce.date().optional(),
  currentStep: z.string(),
  error: z.string().optional(),
  id: z.string(),
  progress: z.number(),
  startedAt: z.coerce.date(),
  status: z.enum(["completed", "failed", "pending", "running"]),
  tables: z.array(z.string()).optional(),
});

const listBackupsResponseSchema = z.object({
  backups: z.array(backupFileSchema),
  error: z.string().optional(),
  jobs: z.array(z.unknown()),
  status: z.literal("ok"),
  warning: z.string().optional(),
});

const tablesResponseSchema = z.object({
  status: z.literal("ok"),
  tables: z.array(z.string()),
});

const logsResponseSchema = z.object({
  logs: z.array(z.unknown()),
  status: z.literal("ok"),
});

const historyResponseSchema = z.object({
  history: z.array(z.unknown()),
  status: z.literal("ok"),
});

const triggerBackupResponseSchema = z.object({
  job: backupJobSchema,
  message: z.string(),
  status: z.literal("ok"),
});

const triggerRestoreResponseSchema = z.object({
  job: restoreJobSchema,
  status: z.literal("ok"),
});

const fileIdSchema = z.object({
  fileId: z.string().min(1),
});

const restoreSchema = z.object({
  fileId: z.string().min(1),
  tables: z.array(z.string()).optional(),
});

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readBackups = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Backup");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", {
      message: "Forbidden - missing 'read Backup' permission",
    });
  }

  return next();
});

const writeBackups = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Backup");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", {
      message: "Forbidden - missing 'create Backup' permission",
    });
  }

  return next();
});

const restoreBackups = authed.use(async ({ context, next }) => {
  const canRestore = await hasPermission(context.user.id, "update", "Backup");

  if (!canRestore) {
    throw new ORPCError("FORBIDDEN", {
      message: "Forbidden - missing 'update Backup' permission",
    });
  }

  return next();
});

const backupsORPCRouterBase = {
  history: readBackups
    .route({ method: "GET", path: "/history", tags: ["Backups"] })
    .output(historyResponseSchema)
    .handler(async () => ({
      history: getJobHistory(),
      status: "ok" as const,
    })),

  list: readBackups
    .route({ method: "GET", path: "/", tags: ["Backups"] })
    .output(listBackupsResponseSchema)
    .handler(async () => {
      if (!(await isOAuthConfigured())) {
        return {
          backups: [],
          jobs: getCurrentJobs(),
          status: "ok" as const,
          warning:
            "Google Drive no configurado. Configura las credenciales OAuth para ver backups.",
        };
      }

      try {
        return {
          backups: await listBackups(),
          jobs: getCurrentJobs(),
          status: "ok" as const,
        };
      } catch (error) {
        return {
          backups: [],
          error: error instanceof Error ? error.message : "Error al conectar con Google Drive",
          jobs: getCurrentJobs(),
          status: "ok" as const,
        };
      }
    }),

  logs: readBackups
    .route({ method: "GET", path: "/logs", tags: ["Backups"] })
    .output(logsResponseSchema)
    .handler(async () => ({
      logs: getLogs(100),
      status: "ok" as const,
    })),

  restore: restoreBackups
    .route({ method: "POST", path: "/{fileId}/restore", tags: ["Backups"] })
    .input(restoreSchema)
    .output(triggerRestoreResponseSchema)
    .handler(async ({ input }) => ({
      job: {
        backupFileId: input.fileId,
        currentStep: "Initializing restore...",
        id: `restore-${Date.now()}`,
        progress: 0,
        startedAt: new Date(),
        status: "pending" as const,
        tables: input.tables,
      },
      status: "ok" as const,
    })),

  tables: readBackups
    .route({ method: "GET", path: "/{fileId}/tables", tags: ["Backups"] })
    .input(fileIdSchema)
    .output(tablesResponseSchema)
    .handler(async ({ input }) => ({
      status: "ok" as const,
      tables: await getBackupTables(input.fileId),
    })),

  trigger: writeBackups
    .route({ method: "POST", path: "/", tags: ["Backups"] })
    .output(triggerBackupResponseSchema)
    .handler(async () => ({
      job: startBackup(),
      message: "Backup started",
      status: "ok" as const,
    })),
};

export const backupsORPCRouter = base.prefix("/api/orpc/backups").router(backupsORPCRouterBase);

export const backupsORPCHandler = new SuperJSONRPCHandler(backupsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.backups",
      });
    }),
  ],
});

export const backupsOpenAPIHandler = new OpenAPIHandler(backupsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Backups oRPC",
          description:
            "Contratos oRPC/OpenAPI para backups. El stream de progreso SSE sigue en /api/backups/progress.",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.backups",
      });
    }),
  ],
});

export type BackupsORPCRouter = typeof backupsORPCRouter;
