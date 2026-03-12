/**
 * Clinical Series Queries & Mutations
 * TanStack Query hooks for clinical series operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesSnapshot,
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
 * Fetch all clinical series with optional filtering
 */
export async function fetchClinicalSeries(
  filters?: ClinicalSeriesFilters,
): Promise<ClinicalSeriesSnapshot[]> {
  try {
    return ClinicalSeriesSnapshotSchema.array().parse(await clinicalSeriesORPCClient.list(filters));
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
 * Rebuild/reorganize clinical series from events
 */
export async function rebuildClinicalSeries(
  params?: RebuildSeriesParams,
): Promise<RebuildSeriesResult> {
  try {
    return RebuildSeriesResultSchema.parse(await clinicalSeriesORPCClient.rebuild(params ?? {}));
  } catch (error) {
    throw toClinicalSeriesApiError(error);
  }
}

/**
 * Hook: Fetch all clinical series
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
 * Hook: Rebuild clinical series (mutation)
 */
export function useRebuildClinicalSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: rebuildClinicalSeries,
    onSuccess: () => {
      // Invalidate all clinical series queries to refetch data
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}
