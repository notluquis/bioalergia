import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { jobRadarORPCClient } from "../orpc";
import { jobRadarKeys, jobRadarQueries, type JobRadarListFilters } from "../queries";

export function useJobPostings(filters: JobRadarListFilters = {}) {
  return useQuery(jobRadarQueries.list(filters));
}

export function useUpdateJobApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.update>[0]) =>
      jobRadarORPCClient.update(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.all }),
  });
}

export function useBulkUpdateJobApplications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.bulkUpdate>[0]) =>
      jobRadarORPCClient.bulkUpdate(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.all }),
  });
}

// Poll del progreso del sync mientras `enabled` (el botón está corriendo).
export function useJobRadarSyncProgress(enabled: boolean) {
  return useQuery({
    queryKey: [...jobRadarKeys.all, "syncProgress"],
    queryFn: () => jobRadarORPCClient.syncProgress(),
    enabled,
    refetchInterval: enabled ? 1200 : false,
    gcTime: 0,
  });
}

export function useSyncJobRadar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => jobRadarORPCClient.syncNow(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.all }),
  });
}

export function useJobRadarSettings() {
  return useQuery(jobRadarQueries.settings());
}

export function useUpdateJobRadarSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.updateSettings>[0]) =>
      jobRadarORPCClient.updateSettings(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.all }),
  });
}

export function useJobSources() {
  return useQuery(jobRadarQueries.sources());
}

export function useAddJobSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.addSource>[0]) =>
      jobRadarORPCClient.addSource(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.sources() }),
  });
}

export function useToggleJobSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.toggleSource>[0]) =>
      jobRadarORPCClient.toggleSource(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.sources() }),
  });
}

export function useDeleteJobSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.deleteSource>[0]) =>
      jobRadarORPCClient.deleteSource(input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.sources() }),
  });
}
