import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { JobPostingDTO } from "@finanzas/orpc-contracts/job-radar";
import { jobRadarORPCClient } from "../orpc";
import { jobRadarKeys, jobRadarQueries, type JobRadarListFilters } from "../queries";

type JobListSnapshot = Array<[QueryKey, JobPostingDTO[] | undefined]>;
type JobPatch = Partial<
  Pick<JobPostingDTO, "applicationStatus" | "appliedAt" | "notes" | "statusUpdatedAt">
>;

const jobRadarListQueryKey = [...jobRadarKeys.all, "list"] as const;

function listFiltersFromKey(key: QueryKey): JobRadarListFilters {
  const filters = Array.isArray(key) && key[0] === "job-radar" && key[1] === "list" ? key[2] : {};
  return filters && typeof filters === "object" && !Array.isArray(filters)
    ? (filters as JobRadarListFilters)
    : {};
}

export function jobMatchesListFilters(job: JobPostingDTO, filters: JobRadarListFilters): boolean {
  if (
    filters.postingStatus &&
    filters.postingStatus !== "ALL" &&
    job.status !== filters.postingStatus
  )
    return false;
  if (filters.applicationStatus && job.applicationStatus !== filters.applicationStatus)
    return false;
  if (filters.source && job.source !== filters.source) return false;
  if (filters.company && job.company !== filters.company) return false;
  if (filters.search?.trim()) {
    const q = filters.search.trim().toLocaleLowerCase("es");
    return [job.title, job.department, job.location, job.company].some((value) =>
      value?.toLocaleLowerCase("es").includes(q)
    );
  }
  return true;
}

export function applyOptimisticJobPatch(
  jobs: JobPostingDTO[] | undefined,
  ids: Set<string>,
  patch: JobPatch,
  filters: JobRadarListFilters
): JobPostingDTO[] | undefined {
  if (!jobs) return jobs;
  return jobs.flatMap((job) => {
    if (!ids.has(job.id)) return [job];
    const next = { ...job, ...patch };
    return jobMatchesListFilters(next, filters) ? [next] : [];
  });
}

async function optimisticPatchJobLists(
  qc: QueryClient,
  ids: string[],
  patch: JobPatch
): Promise<JobListSnapshot> {
  await qc.cancelQueries({ queryKey: jobRadarListQueryKey });
  const previous = qc.getQueriesData<JobPostingDTO[]>({ queryKey: jobRadarListQueryKey });
  const idSet = new Set(ids);
  for (const [queryKey] of previous) {
    qc.setQueryData<JobPostingDTO[]>(queryKey, (old) =>
      applyOptimisticJobPatch(old, idSet, patch, listFiltersFromKey(queryKey))
    );
  }
  return previous;
}

function restoreJobLists(qc: QueryClient, previous: JobListSnapshot | undefined) {
  for (const [queryKey, data] of previous ?? []) qc.setQueryData(queryKey, data);
}

export function useJobPostings(filters: JobRadarListFilters = {}) {
  return useQuery(jobRadarQueries.list(filters));
}

export function useJobRadarFilterOptions(filters: JobRadarListFilters = {}) {
  return useQuery(jobRadarQueries.filterOptions(filters));
}

export function useUpdateJobApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.update>[0]) =>
      jobRadarORPCClient.update(input),
    onMutate: async (input) => {
      const now = new Date();
      return {
        previous: await optimisticPatchJobLists(qc, [input.id], {
          ...(input.applicationStatus
            ? { applicationStatus: input.applicationStatus, statusUpdatedAt: now }
            : {}),
          ...(input.applicationStatus === "APPLIED" ? { appliedAt: now } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        }),
      };
    },
    onError: (_err, _input, context) => restoreJobLists(qc, context?.previous),
    onSettled: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.all }),
  });
}

export function useBulkUpdateJobApplications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof jobRadarORPCClient.bulkUpdate>[0]) =>
      jobRadarORPCClient.bulkUpdate(input),
    onMutate: async (input) => {
      const now = new Date();
      return {
        previous: await optimisticPatchJobLists(qc, input.ids, {
          applicationStatus: input.applicationStatus,
          statusUpdatedAt: now,
          ...(input.applicationStatus === "APPLIED" ? { appliedAt: now } : {}),
        }),
      };
    },
    onError: (_err, _input, context) => restoreJobLists(qc, context?.previous),
    onSettled: () => void qc.invalidateQueries({ queryKey: jobRadarKeys.all }),
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
