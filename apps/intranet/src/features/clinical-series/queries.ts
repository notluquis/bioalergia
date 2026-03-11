/**
 * Clinical Series Queries & Mutations
 * TanStack Query hooks for clinical series operations
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  ClinicalSeriesFilters,
  ClinicalSeriesSnapshot,
  RebuildSeriesParams,
  RebuildSeriesResult,
} from "./types";
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
  const params = new URLSearchParams();
  if (filters?.kind) params.append("kind", filters.kind);
  if (filters?.status) params.append("status", filters.status);
  if (filters?.patientName) params.append("patientName", filters.patientName);
  if (filters?.patientRut) params.append("patientRut", filters.patientRut);
  if (filters?.dateFrom) params.append("dateFrom", filters.dateFrom);
  if (filters?.dateTo) params.append("dateTo", filters.dateTo);

  const response = await apiClient.get<ClinicalSeriesSnapshot[]>(
    `/calendar/clinical-series${params.toString() ? `?${params}` : ""}`,
    { responseSchema: ClinicalSeriesSnapshotSchema.array() },
  );
  return response;
}

/**
 * Fetch single clinical series by ID
 */
export async function fetchClinicalSeriesDetail(id: number): Promise<ClinicalSeriesSnapshot> {
  const response = await apiClient.get<ClinicalSeriesSnapshot>(`/calendar/clinical-series/${id}`, {
    responseSchema: ClinicalSeriesSnapshotSchema,
  });
  return response;
}

/**
 * Rebuild/reorganize clinical series from events
 */
export async function rebuildClinicalSeries(
  params?: RebuildSeriesParams,
): Promise<RebuildSeriesResult> {
  const response = await apiClient.post<RebuildSeriesResult>(
    `/calendar/rpc/series/rebuild`,
    params || {},
    { responseSchema: RebuildSeriesResultSchema },
  );
  return response;
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
