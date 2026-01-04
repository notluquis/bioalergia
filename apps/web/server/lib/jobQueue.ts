/**
 * In-memory job queue for background tasks with progress tracking.
 * Jobs auto-expire after 10 minutes to prevent memory leaks.
 */

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface JobState {
  id: string;
  type: string;
  status: JobStatus;
  progress: number;
  total: number;
  message: string;
  result: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const jobs = new Map<string, JobState>();

// Auto-cleanup interval (every 2 minutes, remove jobs older than 10 minutes)
const CLEANUP_INTERVAL_MS = 2 * 60 * 1000;
const JOB_TTL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt.getTime() > JOB_TTL_MS) {
      jobs.delete(id);
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
    result: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

/**
 * Update job progress
 */
export function updateJobProgress(jobId: string, progress: number, message?: string): void {
  const job = jobs.get(jobId);
  if (!job) return;

  job.progress = progress;
  job.updatedAt = new Date();
  if (message) {
    job.message = message;
  }
}

/**
 * Mark job as completed with result
 */
export function completeJob(jobId: string, result: unknown): void {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "completed";
  job.progress = job.total;
  job.result = result;
  job.message = "Completed";
  job.updatedAt = new Date();
}

/**
 * Mark job as failed with error
 */
export function failJob(jobId: string, error: string): void {
  const job = jobs.get(jobId);
  if (!job) return;

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
 * Get all active jobs of a specific type
 */
export function getActiveJobsByType(type: string): JobState[] {
  return Array.from(jobs.values()).filter((job) => job.type === type && job.status === "running");
}
