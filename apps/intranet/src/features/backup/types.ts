export interface BackupFile {
  createdTime: Date;
  id: string;
  name: string;
  size: string;
  webViewLink?: string;
}

export interface BackupJob {
  completedAt?: Date;
  currentStep: string;
  error?: string;
  id: string;
  progress: number;
  result?: {
    driveFileId: string;
    durationMs: number;
    filename: string;
    message?: string;
    sizeBytes: number;
    skipped?: boolean;
    stats?: Record<string, { count: number; hash: string }>;
    tables: string[];
    webViewLink?: string;
  };
  startedAt: Date;
  status: "completed" | "failed" | "pending" | "running";
  type: "full" | "scheduled";
}

export interface RestoreJob {
  backupFileId: string;
  completedAt?: Date;
  currentStep: string;
  error?: string;
  id: string;
  progress: number;
  startedAt: Date;
  status: "completed" | "failed" | "pending" | "running";
  tables?: string[];
}
