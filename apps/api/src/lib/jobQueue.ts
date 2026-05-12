/**
 * In-memory job queue for background tasks with progress tracking.
 * Jobs auto-expire after 10 minutes to prevent memory leaks.
 */

export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface JobState {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  total: number;
  message: string;
  meta: Record<string, unknown> | null;
  result: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobs = new Map<string, JobState>();
const cancelledJobs = new Set<string>();

// Auto-cleanup interval (every 2 minutes, remove jobs older than 10 minutes)
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
const JOB_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt.getTime() > JOB_TTL_MS) {
      jobs.delete(id);
      cancelledJobs.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Start a new job and return its ID
 */
export function startJob(type: string, total: number): string {
  const id = generateJobId();
  const now = new Date();

  jobs.set(id, {
    id,
    type,
    status: "running",
    progress: 0,
    total,
    message: `Starting ${type}...`,
    meta: null,
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  });

  cancelledJobs.delete(id);

  return id;
}

/**
 * Update job progress
 */
export function updateJobProgress(
  jobId: string,
  progress: number,
  message?: string,
  meta?: Record<string, unknown> | null,
  total?: number
): void {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }
  if (job.status === "cancelled") {
    return;
  }

  job.progress = progress;
  if (typeof total === "number" && Number.isFinite(total)) {
    job.total = Math.max(0, total);
  }
  if (meta !== undefined) {
    job.meta = meta;
  }
  job.updatedAt = new Date();
  if (message) {
    job.message = message;
  }
}

/**
 * Mark job as completed with result
 */
export function completeJob(
  jobId: string,
  result: unknown,
  message = "Completed",
  meta?: Record<string, unknown> | null,
  total?: number
): void {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }
  if (job.status === "cancelled") {
    return;
  }

  job.status = "completed";
  if (typeof total === "number" && Number.isFinite(total)) {
    job.total = Math.max(0, total);
  }
  job.progress = job.total;
  job.result = result;
  job.message = message;
  if (meta !== undefined) {
    job.meta = meta;
  }
  job.updatedAt = new Date();
}

/**
 * Mark job as failed with error
 */
export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) {
    return;
  }
  if (job.status === "cancelled") {
    return;
  }

  job.status = "failed";
  job.error = error;
  job.message = `Error: ${error}`;
  job.updatedAt = new Date();
}

/**
 * Get job status
 */
export function getJobStatus(jobId: string): JobState | null {
  return jobs.get(jobId) ?? null;
}

/**
 * Cancel a running/pending job.
 */
export function cancelJob(jobId: string, message = "Cancelado por usuario"): boolean {
  const job = jobs.get(jobId);
  if (!job) return false;
  if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
    return false;
  }

  job.status = "cancelled";
  job.message = message;
  job.error = null;
  job.updatedAt = new Date();
  cancelledJobs.add(jobId);
  return true;
}

/**
 * Read cancellation token for long-running workers.
 */
export function isJobCancelled(jobId: string): boolean {
  return cancelledJobs.has(jobId);
}

/**
 * Get all active jobs of a specific type
 */
export function getActiveJobsByType(type: string): JobState[] {
  return Array.from(jobs.values()).filter((job) => job.type === type && job.status === "running");
}
