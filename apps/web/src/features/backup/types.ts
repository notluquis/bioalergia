export interface BackupFile {
  id: string;
  name: string;
  createdTime: string;
  size: string;
  webViewLink?: string;
}

export interface BackupJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  type: "full" | "scheduled";
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentStep: string;
  result?: {
    filename: string;
    sizeBytes: number;
    durationMs: number;
    driveFileId: string;
    tables: string[];
  };
  error?: string;
}

export interface RestoreJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  backupFileId: string;
  tables?: string[];
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentStep: string;
  error?: string;
}
