export interface BackupFile {
  createdTime: string;
  id: string;
  name: string;
  size: string;
  webViewLink?: string;
}

export interface BackupJob {
  completedAt?: string;
  currentStep: string;
  error?: string;
  id: string;
  progress: number;
  result?: {
    driveFileId: string;
    durationMs: number;
    filename: string;
    sizeBytes: number;
    tables: string[];
  };
  startedAt: string;
  status: "completed" | "failed" | "pending" | "running";
  type: "full" | "scheduled";
}

export interface RestoreJob {
  backupFileId: string;
  completedAt?: string;
  currentStep: string;
  error?: string;
  id: string;
  progress: number;
  startedAt: string;
  status: "completed" | "failed" | "pending" | "running";
  tables?: string[];
}
