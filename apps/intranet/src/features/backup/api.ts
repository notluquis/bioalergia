import { z } from "zod";
import { apiClient } from "@/lib/api-client";

import type { BackupFile, BackupJob, RestoreJob } from "./types";

const BackupsResponseSchema = z.object({
  backups: z.array(z.unknown()),
});

const TablesResponseSchema = z.object({
  tables: z.array(z.string()),
});

const BackupJobSchema = z.looseObject({});

const RestoreJobSchema = z.looseObject({});

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
