import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { compactORPCInput } from "@/lib/orpc-input";
import { clinicalSeriesKeys } from "./queries";
import { clinicalSkinTestsORPCClient, toClinicalSkinTestsApiError } from "./skin-tests-orpc";
import {
  ClinicalDocumentImportSchema,
  OneDriveFolderFileSchema,
  OneDriveFolderItemSchema,
  SkinTestAnalyticsSchema,
  SkinTestDetailSchema,
  SkinTestImportSchema,
  type SkinTestImportStatus,
} from "./skin-tests-types";

export type SkinTestSnapshotStatus = "ARCHIVED" | "ERROR" | "MISSING" | "STALE";

export interface SkinTestImportFilters {
  confidenceMax?: number;
  confidenceMin?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  snapshotStatus?: SkinTestSnapshotStatus;
  sortBy?: "testDate" | "updatedAt";
  status?: SkinTestImportStatus;
}

export interface SkinTestAnalyticsFilters {
  dateFrom?: string;
  dateTo?: string;
  examType?: string;
  pageSize?: number;
  query?: string;
}

export const skinTestImportKeys = {
  all: ["clinical-skin-tests"] as const,
  activeJob: () => [...skinTestImportKeys.all, "active-job"] as const,
  analytics: (filters?: SkinTestAnalyticsFilters) =>
    [...skinTestImportKeys.all, "analytics", filters] as const,
  importsBase: () => [...skinTestImportKeys.all, "imports"] as const,
  imports: (filters?: SkinTestImportFilters) =>
    [...skinTestImportKeys.all, "imports", filters] as const,
  oneDriveFolders: (accountId: string, driveId?: null | string, itemId?: null | string) =>
    [
      ...skinTestImportKeys.all,
      "onedrive-folders",
      accountId,
      driveId ?? "root",
      itemId ?? "root",
    ] as const,
  oneDriveFolderPreview: (accountId: string, driveId?: null | string, itemId?: null | string) =>
    [
      ...skinTestImportKeys.all,
      "onedrive-folder-preview",
      accountId,
      driveId ?? "root",
      itemId ?? "root",
    ] as const,
  oneDriveStatus: () => [...skinTestImportKeys.all, "onedrive-status"] as const,
  seriesDocuments: (seriesId: number) =>
    [...skinTestImportKeys.all, "series", seriesId, "documents"] as const,
  seriesTests: (seriesId: number) => [...skinTestImportKeys.all, "series", seriesId] as const,
};

export function useOneDriveSkinTestStatus() {
  return useQuery({
    queryFn: async () => clinicalSkinTestsORPCClient.getOneDriveStatus({}),
    queryKey: skinTestImportKeys.oneDriveStatus(),
  });
}

export function useActiveClinicalSkinTestJob(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: async () => await clinicalSkinTestsORPCClient.activeJob({}),
    queryKey: skinTestImportKeys.activeJob(),
    staleTime: 1000,
    retry: 2,
    refetchInterval: (query) => {
      // If query errored (e.g. 401 during re-auth), keep retrying
      if (query.state.status === "error") return 3000;
      const status = query.state.data?.job?.status;
      if (!status) return false;
      return ["completed", "failed", "cancelled"].includes(status) ? false : 5000;
    },
  });
}

export function useGetOneDriveAuthUrl(redirectUri: string) {
  return useQuery({
    enabled: false, // only run on demand
    queryFn: async () => clinicalSkinTestsORPCClient.getOneDriveAuthUrl({ redirectUri }),
    queryKey: ["onedrive-auth-url", redirectUri],
  });
}

export function useConnectOneDrive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { code: string; redirectUri: string }) =>
      clinicalSkinTestsORPCClient.connectOneDrive(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.oneDriveStatus() });
    },
  });
}

export function useSkinTestImports(filters?: SkinTestImportFilters) {
  return useQuery({
    queryFn: async () => {
      try {
        const result = await clinicalSkinTestsORPCClient.listImports(
          compactORPCInput(filters) ?? {}
        );
        return {
          ...result,
          items: SkinTestImportSchema.array().parse(result.items),
        };
      } catch (error) {
        throw toClinicalSkinTestsApiError(error);
      }
    },
    queryKey: skinTestImportKeys.imports(filters),
  });
}

export function useSkinTestAnalytics(filters?: SkinTestAnalyticsFilters) {
  return useQuery({
    queryFn: async () => {
      try {
        const result = await clinicalSkinTestsORPCClient.analytics(compactORPCInput(filters) ?? {});
        return SkinTestAnalyticsSchema.parse(result);
      } catch (error) {
        throw toClinicalSkinTestsApiError(error);
      }
    },
    queryKey: skinTestImportKeys.analytics(filters),
  });
}

export function useSkinTestsBySeries(seriesId: number | null) {
  return useQuery({
    enabled: seriesId != null,
    queryFn: async () => {
      const result = await clinicalSkinTestsORPCClient.listTestsBySeries({
        clinicalSeriesId: seriesId!,
      });
      return SkinTestDetailSchema.array().parse(result.tests);
    },
    queryKey: skinTestImportKeys.seriesTests(seriesId!),
  });
}

export function useClinicalDocumentsBySeries(seriesId: number | null) {
  return useQuery({
    enabled: seriesId != null,
    queryFn: async () => {
      const result = await clinicalSkinTestsORPCClient.listDocumentsBySeries({
        clinicalSeriesId: seriesId!,
      });
      return ClinicalDocumentImportSchema.array().parse(result.documents);
    },
    queryKey: skinTestImportKeys.seriesDocuments(seriesId!),
  });
}

export function useSyncSkinTestImports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: {
      accountId?: string;
      folderDriveId?: null | string;
      folderItemId?: null | string;
      folderPath?: string;
      force?: boolean;
    }) => await clinicalSkinTestsORPCClient.sync(compactORPCInput(params) ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.activeJob() });
    },
  });
}

export function useConfigureOneDriveFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      accountId: string;
      driveId?: null | string;
      folderPath?: string;
      itemId?: null | string;
      name?: null | string;
    }) => await clinicalSkinTestsORPCClient.configureOneDriveFolder(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.oneDriveStatus() });
    },
  });
}

export function useOneDriveFolderChildren(params: {
  accountId: string;
  driveId?: null | string;
  enabled?: boolean;
  itemId?: null | string;
}) {
  return useQuery({
    enabled: params.enabled ?? true,
    queryFn: async () => {
      const result = await clinicalSkinTestsORPCClient.listOneDriveFolderChildren({
        accountId: params.accountId,
        driveId: params.driveId,
        itemId: params.itemId,
      });
      const raw = result as unknown as typeof result & { files?: unknown[] };
      return {
        ...result,
        files: OneDriveFolderFileSchema.array().parse(raw.files ?? []),
        folders: OneDriveFolderItemSchema.array().parse(result.folders),
      };
    },
    queryKey: skinTestImportKeys.oneDriveFolders(params.accountId, params.driveId, params.itemId),
  });
}

export function useRenewOneDriveSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) =>
      await clinicalSkinTestsORPCClient.renewOneDriveSubscription({ accountId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.oneDriveStatus() });
    },
  });
}

export function useDisconnectOneDrive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) =>
      await clinicalSkinTestsORPCClient.disconnectOneDrive({ accountId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.oneDriveStatus() });
    },
  });
}

export function useApproveSkinTestImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await clinicalSkinTestsORPCClient.approveImport({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.importsBase() });
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}

export function useRejectSkinTestImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await clinicalSkinTestsORPCClient.rejectImport({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.importsBase() });
    },
  });
}

export function useReprocessSkinTestImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await clinicalSkinTestsORPCClient.reprocessImport({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.importsBase() });
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}

export function useProcessSkinTestImports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => await clinicalSkinTestsORPCClient.processImports({ ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.importsBase() });
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}

export function useProcessDiscoveredSkinTestImports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { query?: string }) =>
      await clinicalSkinTestsORPCClient.processDiscoveredImports(compactORPCInput(params) ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.activeJob() });
    },
  });
}

export function useReprocessPendingSkinTestImports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { query?: string }) =>
      await clinicalSkinTestsORPCClient.reprocessPendingImports(compactORPCInput(params) ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.activeJob() });
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.importsBase() });
    },
  });
}

export function useReclassifyClinicalXlsxLibrary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => await clinicalSkinTestsORPCClient.reclassifyXlsxLibrary({}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.activeJob() });
    },
  });
}

export function useArchiveSkinTestWorkbookSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: {
      accountId?: string;
      dryRun?: boolean;
      importStatus?: SkinTestImportStatus;
      limit?: number;
      onlyChanged?: boolean;
      onlyMissing?: boolean;
      query?: string;
    }) => await clinicalSkinTestsORPCClient.archiveSnapshots(compactORPCInput(params) ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.activeJob() });
    },
  });
}

export function useClinicalSkinTestJobStatus(jobId: string | null) {
  return useQuery({
    enabled: !!jobId,
    queryFn: async () => await clinicalSkinTestsORPCClient.jobStatus({ jobId: jobId! }),
    queryKey: [...skinTestImportKeys.all, "job-status", jobId],
    retry: (failureCount, error) => {
      // Stop retrying on 404 (job expired/not found)
      if (error && typeof error === "object" && "status" in error && error.status === 404) {
        return false;
      }
      return failureCount < 2;
    },
    refetchInterval: (query) => {
      // Stop polling entirely on 404 errors (job expired)
      if (query.state.status === "error") {
        const err = query.state.error;
        if (err && typeof err === "object" && "status" in err && err.status === 404) {
          return false;
        }
        return 3000;
      }
      const status = query.state.data?.job?.status;
      if (!status) return 2000;
      return ["completed", "failed", "cancelled"].includes(status) ? false : 2000;
    },
  });
}

export function useCancelClinicalSkinTestJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => await clinicalSkinTestsORPCClient.cancelJob({ jobId }),
    onSuccess: async (_result, jobId) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [...skinTestImportKeys.all, "job-status", jobId],
        }),
        queryClient.invalidateQueries({ queryKey: skinTestImportKeys.activeJob() }),
        queryClient.invalidateQueries({ queryKey: skinTestImportKeys.importsBase() }),
      ]);
    },
  });
}

export function useOneDriveFolderPreview(params: {
  accountId: string;
  driveId?: null | string;
  enabled?: boolean;
  itemId?: null | string;
}) {
  return useQuery({
    // Only fetch when a specific folder is selected (not root — too expensive without a target)
    enabled: (params.enabled ?? true) && !!(params.driveId && params.itemId),
    queryFn: async () =>
      await clinicalSkinTestsORPCClient.folderPreview({
        accountId: params.accountId,
        driveId: params.driveId,
        itemId: params.itemId,
      }),
    queryKey: skinTestImportKeys.oneDriveFolderPreview(
      params.accountId,
      params.driveId,
      params.itemId
    ),
    // Recursive delta scan is expensive — cache for 30s to avoid re-scanning on each breadcrumb click
    staleTime: 30_000,
  });
}
