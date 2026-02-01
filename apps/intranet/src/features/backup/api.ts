import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { BackupFile, BackupJob, RestoreJob } from "./types";

const BackupFileSchema = z.looseObject({
  createdTime: z.coerce.date(),
  id: z.string(),
  name: z.string(),
  size: z.string(),
  webViewLink: z.string().optional(),
});

const BackupsResponseSchema = z.object({
  backups: z.array(BackupFileSchema),
});

const TablesResponseSchema = z.object({
  tables: z.array(z.string()),
});

const BackupJobSchema = z.looseObject({
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
      sizeBytes: z.number(),
      tables: z.array(z.string()),
    })
    .optional(),
  startedAt: z.coerce.date(),
  status: z.enum(["completed", "failed", "pending", "running"]),
  type: z.enum(["full", "scheduled"]),
});

const RestoreJobSchema = z.looseObject({
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

export const fetchBackups = async (): Promise<BackupFile[]> => {
  const data = await apiClient.get<{ backups: BackupFile[] }>("/api/backups", {
    responseSchema: BackupsResponseSchema,
  });
  return data.backups;
};

export const fetchTables = async (fileId: string): Promise<string[]> => {
  const data = await apiClient.get<{ tables: string[] }>(`/api/backups/${fileId}/tables`, {
    responseSchema: TablesResponseSchema,
  });
  return data.tables;
};

export const triggerBackup = async (): Promise<{ job: BackupJob }> => {
  const job = await apiClient.post<BackupJob>(
    "/api/backups",
    {},
    { responseSchema: BackupJobSchema },
  );
  return { job };
};

export const triggerRestore = async (
  fileId: string,
  tables?: string[],
): Promise<{ job: RestoreJob }> => {
  const job = await apiClient.post<RestoreJob>(
    `/api/backups/${fileId}/restore`,
    { tables },
    { responseSchema: RestoreJobSchema },
  );
  return { job };
};
