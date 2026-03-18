/**
 * Clinical Series Queries & Mutations
 * TanStack Query hooks for clinical series operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { compactORPCInput } from "@/lib/orpc-input";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesListResult,
  ClinicalSeriesSnapshot,
  RebuildJob,
  RebuildSeriesParams,
  RebuildSeriesResult,
} from "./types";
import { clinicalSeriesORPCClient, toClinicalSeriesApiError } from "./orpc";
import { ClinicalSeriesSnapshotSchema, RebuildSeriesResultSchema } from "./types";

// Query keys for cache invalidation
export const clinicalSeriesKeys = {
  all: ["clinical-series"] as const,
  lists: () => [...clinicalSeriesKeys.all, "list"] as const,
  list: (filters?: ClinicalSeriesFilters) => [...clinicalSeriesKeys.lists(), filters] as const,
  details: () => [...clinicalSeriesKeys.all, "detail"] as const,
  detail: (id: number) => [...clinicalSeriesKeys.details(), id] as const,
};

/**
 * Fetch paginated clinical series with optional filtering
 */
export async function fetchClinicalSeries(
  filters?: ClinicalSeriesFilters
): Promise<ClinicalSeriesListResult> {
  try {
    const result = (await clinicalSeriesORPCClient.list(
      compactORPCInput(filters) ?? {}
    )) as unknown as ClinicalSeriesListResult;
    return {
      items: ClinicalSeriesSnapshotSchema.array().parse(result.items),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

/**
 * Fetch single clinical series by ID
 */
export async function fetchClinicalSeriesDetail(id: number): Promise<ClinicalSeriesSnapshot> {
  try {
    return ClinicalSeriesSnapshotSchema.parse(await clinicalSeriesORPCClient.detail({ id }));
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

/**
 * Trigger a rebuild (non-blocking — returns { jobId } immediately)
 */
export async function rebuildClinicalSeries(
  params?: RebuildSeriesParams
): Promise<RebuildSeriesResult> {
  try {
    return RebuildSeriesResultSchema.parse(
      await clinicalSeriesORPCClient.rebuild(compactORPCInput(params) ?? {})
    );
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

/**
 * Hook: Fetch paginated clinical series
 */
export function useClinicalSeries(filters?: ClinicalSeriesFilters) {
  return useQuery({
    queryFn: () => fetchClinicalSeries(filters),
    queryKey: clinicalSeriesKeys.list(filters),
  });
}

/**
 * Hook: Fetch single clinical series
 */
export function useClinicalSeriesDetail(id: number) {
  return useQuery({
    enabled: !!id,
    queryFn: () => fetchClinicalSeriesDetail(id),
    queryKey: clinicalSeriesKeys.detail(id),
  });
}

/**
 * Hook: Trigger rebuild mutation (fire-and-forget, progress via SSE)
 */
export function useRebuildClinicalSeries() {
  return useMutation({ mutationFn: rebuildClinicalSeries });
}

/**
 * Hook: SSE stream for real-time rebuild progress.
 * Connects to /api/clinical-series/progress, reconnects on error.
 * Invalidates all clinical-series queries when job transitions to "completed".
 */
export function useClinicalSeriesRebuildProgress() {
  const queryClient = useQueryClient();
  const [job, setJob] = useState<null | RebuildJob>(null);
  const prevStatusRef = useRef<null | string>(null);

  // Invalidate queries when job completes
  useEffect(() => {
    if (job?.status === "completed" && prevStatusRef.current === "running") {
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    }
    prevStatusRef.current = job?.status ?? null;
  }, [job?.status, queryClient]);

  useEffect(() => {
    const eventSource = new EventSource("/api/clinical-series/progress");

    eventSource.addEventListener("message", (e: MessageEvent) => {
      try {
        const msg = JSON.parse(String(e.data)) as { job: null | RebuildJob };
        setJob(msg.job);
      } catch {
        // Ignore parse errors
      }
    });

    eventSource.addEventListener("error", () => {
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, []);

  return job;
}
