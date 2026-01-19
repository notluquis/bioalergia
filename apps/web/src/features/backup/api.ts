import { apiClient } from "@/lib/api-client";

import type { BackupFile, BackupJob, RestoreJob } from "./types";

export const fetchBackups = async (): Promise<BackupFile[]> => {
  const data = await apiClient.get<{ backups: BackupFile[] }>("/api/backups");
  return data.backups;
};

export const fetchTables = async (fileId: string): Promise<string[]> => {
  const data = await apiClient.get<{ tables: string[] }>(`/api/backups/${fileId}/tables`);
  return data.tables;
};

export const triggerBackup = async (): Promise<{ job: BackupJob }> => {
  const job = await apiClient.post<BackupJob>("/api/backups", {});
  return { job };
};

export const triggerRestore = async (fileId: string, tables?: string[]): Promise<{ job: RestoreJob }> => {
  const job = await apiClient.post<RestoreJob>(`/api/backups/${fileId}/restore`, { tables });
  return { job };
};
