// Thin façade for the rebuild-job state holder. Lives outside
// `clinical-series.ts` so that consumers that only need to observe
// the current job (notably `app.ts`'s SSE endpoint at
// /api/clinical-series/progress) don't drag the whole 4.6k-LOC
// clinical-series module — and its ZenStack relation graph — into
// their type-check closure. The heavy module imports these helpers
// to mutate state; observers import only `getCurrentRebuildJob`.

export interface RebuildJob {
  error?: string;
  from: null | string;
  jobId: string;
  processed: number;
  progress: number;
  status: "completed" | "failed" | "running";
  currentStep: string;
  to: null | string;
  total: number;
}

let currentRebuildJob: null | RebuildJob = null;

export function getCurrentRebuildJob(): null | RebuildJob {
  return currentRebuildJob;
}

export function setRebuildJob(job: null | RebuildJob): void {
  currentRebuildJob = job;
}

/** Apply a patch only if the current job's id still matches — no-op
 *  when a newer job has superseded this one. */
export function patchRebuildJob(jobId: string, patch: Partial<RebuildJob>): void {
  if (!currentRebuildJob || currentRebuildJob.jobId !== jobId) return;
  Object.assign(currentRebuildJob, patch);
}

/** Clear the job after a delay, but only if it's still the one we
 *  started (defensive against fast successive rebuilds). */
export function clearRebuildJobAfter(jobId: string, ms: number): void {
  setTimeout(() => {
    if (currentRebuildJob?.jobId === jobId) currentRebuildJob = null;
  }, ms);
}
