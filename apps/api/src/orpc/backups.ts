import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import {
  backupsFileIdSchema,
  backupsHistoryResponseSchema,
  backupsListResponseSchema,
  backupsLogsResponseSchema,
  backupsRestoreResponseSchema,
  backupsRestoreSchema,
  backupsTablesResponseSchema,
  backupsTriggerResponseSchema,
} from "@finanzas/orpc-contracts/backups";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth.ts";
import { isOAuthConfigured } from "../lib/google/google-core.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import { getCurrentJobs, getJobHistory, getLogs, startBackup } from "../services/backups.ts";
import { getBackupTables, listBackups } from "../services/drive.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type BackupsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<BackupsORPCContext>();

type BackupJobOutput = z.output<typeof backupsTriggerResponseSchema>["job"];

function toBackupJobOutput(job: {
  completedAt?: Date;
  currentStep: string;
  error?: string;
  id: string;
  progress: number;
  result?: Record<string, unknown>;
  startedAt: Date;
  status: "completed" | "failed" | "pending" | "running" | "uploading";
  type: "full" | "scheduled";
}): BackupJobOutput {
  const rawResult = job.result;
  const hasStructuredResult =
    rawResult &&
    typeof rawResult.driveFileId === "string" &&
    typeof rawResult.durationMs === "number" &&
    typeof rawResult.filename === "string" &&
    typeof rawResult.sizeBytes === "number" &&
    Array.isArray(rawResult.tables);

  return {
    completedAt: job.completedAt,
    currentStep: job.currentStep,
    error: job.error,
    id: job.id,
    progress: job.progress,
    result: hasStructuredResult
      ? {
          driveFileId: rawResult.driveFileId as string,
          durationMs: rawResult.durationMs as number,
          filename: rawResult.filename as string,
          message: typeof rawResult.message === "string" ? rawResult.message : undefined,
          sizeBytes: rawResult.sizeBytes as number,
          skipped: typeof rawResult.skipped === "boolean" ? rawResult.skipped : undefined,
          stats:
            rawResult.stats &&
            typeof rawResult.stats === "object" &&
            !Array.isArray(rawResult.stats)
              ? (rawResult.stats as Record<string, { count: number; hash: string }>)
              : undefined,
          tables: rawResult.tables as string[],
          webViewLink:
            typeof rawResult.webViewLink === "string" ? rawResult.webViewLink : undefined,
        }
      : undefined,
    startedAt: job.startedAt,
    status: job.status,
    type: job.type,
  };
}

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
  const canRead = await hasPermission(context.user, "read", "Backup");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", {
      message: "Forbidden - missing 'read Backup' permission",
    });
  }

  return next();
});

const writeBackups = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Backup");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", {
      message: "Forbidden - missing 'create Backup' permission",
    });
  }

  return next();
});

const restoreBackups = authed.use(async ({ context, next }) => {
  const canRestore = await hasPermission(context.user, "update", "Backup");

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
    .output(backupsHistoryResponseSchema)
    .handler(async () => ({
      history: getJobHistory(),
      status: "ok" as const,
    })),

  list: readBackups
    .route({ method: "GET", path: "/", tags: ["Backups"] })
    .output(backupsListResponseSchema)
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
    .output(backupsLogsResponseSchema)
    .handler(async () => ({
      logs: getLogs(100),
      status: "ok" as const,
    })),

  restore: restoreBackups
    .route({ method: "POST", path: "/{fileId}/restore", tags: ["Backups"] })
    .input(backupsRestoreSchema)
    .output(backupsRestoreResponseSchema)
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
    .input(backupsFileIdSchema)
    .output(backupsTablesResponseSchema)
    .handler(async ({ input }) => ({
      status: "ok" as const,
      tables: await getBackupTables(input.fileId),
    })),

  trigger: writeBackups
    .route({ method: "POST", path: "/", tags: ["Backups"] })
    .output(backupsTriggerResponseSchema)
    .handler(async () => ({
      job: toBackupJobOutput(startBackup()),
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
          version: "1.0.0",
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
