// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
/**
 * Clinical Series Queries & Mutations
 * TanStack Query hooks for clinical series operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { compactORPCInput } from "@/lib/orpc-input";
import type {
  AbandonmentContact,
  ClinicalSeriesDuplicate,
  ClinicalSeriesFilters,
  ClinicalSeriesInsuranceStats,
  ClinicalSeriesListResult,
  ClinicalSeriesSnapshot,
  MergeClinicalSeriesParams,
  MergeClinicalSeriesResult,
  RebuildJob,
  RebuildSeriesParams,
  RebuildSeriesResult,
} from "./types";
import { clinicalSeriesORPCClient, toClinicalSeriesApiError } from "./orpc";
import {
  AbandonmentContactSchema,
  ClinicalSeriesInsuranceStatsSchema,
  ClinicalSeriesSnapshotSchema,
  DetectDuplicatesResultSchema,
  MergeClinicalSeriesResultSchema,
  RebuildSeriesResultSchema,
} from "./types";

// Query keys for cache invalidation
export const clinicalSeriesKeys = {
  all: ["clinical-series"] as const,
  lists: () => [...clinicalSeriesKeys.all, "list"] as const,
  list: (filters?: ClinicalSeriesFilters) => [...clinicalSeriesKeys.lists(), filters] as const,
  details: () => [...clinicalSeriesKeys.all, "detail"] as const,
  detail: (id: number) => [...clinicalSeriesKeys.details(), id] as const,
  duplicates: () => [...clinicalSeriesKeys.all, "duplicates"] as const,
  insuranceStats: (filters?: ClinicalSeriesFilters) =>
    [...clinicalSeriesKeys.all, "insurance-stats", filters] as const,
};

/**
 * Fetch paginated clinical series with optional filtering
 */
export async function fetchClinicalSeries(
  filters?: ClinicalSeriesFilters
): Promise<ClinicalSeriesListResult> {
  try {
    const result = await clinicalSeriesORPCClient.list(compactORPCInput(filters) ?? {});
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

export async function fetchClinicalSeriesInsuranceStats(
  filters?: ClinicalSeriesFilters
): Promise<ClinicalSeriesInsuranceStats> {
  try {
    return ClinicalSeriesInsuranceStatsSchema.parse(
      await clinicalSeriesORPCClient.insuranceStats(compactORPCInput(filters) ?? {})
    );
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

export function useClinicalSeriesInsuranceStats(filters?: ClinicalSeriesFilters) {
  return useQuery({
    queryFn: () => fetchClinicalSeriesInsuranceStats(filters),
    queryKey: clinicalSeriesKeys.insuranceStats(filters),
  });
}

/**
 * Detect duplicate clinical series
 */
export async function fetchDetectDuplicates(): Promise<ClinicalSeriesDuplicate[]> {
  try {
    const result = DetectDuplicatesResultSchema.parse(
      await clinicalSeriesORPCClient.detectDuplicates({})
    );
    return result.duplicates;
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

/**
 * Merge two clinical series
 */
export async function mergeClinicalSeries(
  params: MergeClinicalSeriesParams
): Promise<MergeClinicalSeriesResult> {
  try {
    return MergeClinicalSeriesResultSchema.parse(await clinicalSeriesORPCClient.merge(params));
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

/**
 * Hook: Trigger rebuild mutation (fire-and-forget, progress via SSE)
 */
export function useRebuildClinicalSeries() {
  return useMutation({ mutationFn: rebuildClinicalSeries });
}

/**
 * Hook: Detect duplicate series
 */
export function useDetectDuplicates() {
  return useQuery({
    queryFn: fetchDetectDuplicates,
    queryKey: clinicalSeriesKeys.duplicates(),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Abandonment Contacts ──────────────────────────────────────────────────────

export const abandonmentContactKeys = {
  all: ["abandonment-contacts"] as const,
  list: (seriesId: number) => [...abandonmentContactKeys.all, seriesId] as const,
};

export async function fetchAbandonmentContacts(seriesId: number): Promise<AbandonmentContact[]> {
  try {
    const result = await clinicalSeriesORPCClient.listAbandonmentContacts({ seriesId });
    return AbandonmentContactSchema.array().parse(result.contacts);
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

export function useAbandonmentContacts(seriesId: number | null) {
  return useQuery({
    enabled: seriesId != null,
    queryFn: () => fetchAbandonmentContacts(seriesId!),
    queryKey: abandonmentContactKeys.list(seriesId!),
  });
}

export function useCreateAbandonmentContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { seriesId: number; outcome: string; notes?: string }) => {
      try {
        return AbandonmentContactSchema.parse(
          await clinicalSeriesORPCClient.createAbandonmentContact(params as never)
        );
      } catch (error) {
        throw toClinicalSeriesApiError(error);
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: abandonmentContactKeys.list(variables.seriesId),
      });
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}

/**
 * Hook: Merge two clinical series
 */
export function useMergeClinicalSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mergeClinicalSeries,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
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
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource("/api/clinical-series/progress");

      es.addEventListener("message", (e: MessageEvent) => {
        try {
          const msg = JSON.parse(String(e.data)) as { job: null | RebuildJob };
          setJob(msg.job);
        } catch {
          // Ignore parse errors
        }
      });

      es.addEventListener("error", () => {
        es?.close();
        es = null;
        // Reconnect after 3s (handles session expiry + re-login)
        if (!cancelled) {
          retryTimer = setTimeout(connect, 3000);
        }
      });
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
    };
  }, []);

  return job;
}
