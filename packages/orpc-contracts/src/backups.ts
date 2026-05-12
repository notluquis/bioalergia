import { oc } from "@orpc/contract";
import { z } from "zod";

export const backupFileSchema = z.object({
  createdTime: z.string(),
  customChecksum: z.string().optional(),
  id: z.string(),
  name: z.string(),
  size: z.string(),
  webViewLink: z.string().optional(),
});

export const backupJobSchema = z.looseObject({
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
          })
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

export const restoreJobSchema = z.looseObject({
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

export const backupsListResponseSchema = z.object({
  backups: z.array(backupFileSchema),
  error: z.string().optional(),
  jobs: z.array(z.unknown()),
  status: z.literal("ok"),
  warning: z.string().optional(),
});

export const backupsTablesResponseSchema = z.object({
  status: z.literal("ok"),
  tables: z.array(z.string()),
});

export const backupsLogsResponseSchema = z.object({
  logs: z.array(z.unknown()),
  status: z.literal("ok"),
});

export const backupsHistoryResponseSchema = z.object({
  history: z.array(z.unknown()),
  status: z.literal("ok"),
});

export const backupsTriggerResponseSchema = z.object({
  job: backupJobSchema,
  message: z.string(),
  status: z.literal("ok"),
});

export const backupsRestoreResponseSchema = z.object({
  job: restoreJobSchema,
  status: z.literal("ok"),
});

export const backupsFileIdSchema = z.object({
  fileId: z.string().min(1),
});

export const backupsRestoreSchema = z.object({
  fileId: z.string().min(1),
  tables: z.array(z.string()).optional(),
});

export const backupsContract = {
  history: oc.route({ method: "GET", path: "/history" }).output(backupsHistoryResponseSchema),
  list: oc.route({ method: "GET", path: "/" }).output(backupsListResponseSchema),
  logs: oc.route({ method: "GET", path: "/logs" }).output(backupsLogsResponseSchema),
  restore: oc
    .route({ method: "POST", path: "/{fileId}/restore" })
    .input(backupsRestoreSchema)
    .output(backupsRestoreResponseSchema),
  tables: oc
    .route({ method: "GET", path: "/{fileId}/tables" })
    .input(backupsFileIdSchema)
    .output(backupsTablesResponseSchema),
  trigger: oc.route({ method: "POST", path: "/" }).output(backupsTriggerResponseSchema),
};

export type BackupsContract = typeof backupsContract;
