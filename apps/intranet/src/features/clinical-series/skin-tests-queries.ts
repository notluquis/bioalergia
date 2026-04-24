import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { compactORPCInput } from "@/lib/orpc-input";
import { clinicalSeriesKeys } from "./queries";
import { clinicalSkinTestsORPCClient, toClinicalSkinTestsApiError } from "./skin-tests-orpc";
import {
  SkinTestDetailSchema,
  SkinTestImportSchema,
  type SkinTestImportStatus,
} from "./skin-tests-types";

export interface SkinTestImportFilters {
  confidenceMax?: number;
  confidenceMin?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  query?: string;
  status?: SkinTestImportStatus;
}

export const skinTestImportKeys = {
  all: ["clinical-skin-tests"] as const,
  imports: (filters?: SkinTestImportFilters) =>
    [...skinTestImportKeys.all, "imports", filters] as const,
  oneDriveStatus: () => [...skinTestImportKeys.all, "onedrive-status"] as const,
  seriesTests: (seriesId: number) => [...skinTestImportKeys.all, "series", seriesId] as const,
};

export function useOneDriveSkinTestStatus() {
  return useQuery({
    queryFn: async () => clinicalSkinTestsORPCClient.getOneDriveStatus({}),
    queryKey: skinTestImportKeys.oneDriveStatus(),
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

export function useSyncSkinTestImports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params?: { force?: boolean; folderPath?: string }) =>
      await clinicalSkinTestsORPCClient.sync(compactORPCInput(params) ?? {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.all });
    },
  });
}

export function useConfigureOneDriveFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (folderPath: string) =>
      await clinicalSkinTestsORPCClient.configureOneDriveFolder({ folderPath }),
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
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.all });
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}

export function useRejectSkinTestImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await clinicalSkinTestsORPCClient.rejectImport({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.all });
    },
  });
}

export function useReprocessSkinTestImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => await clinicalSkinTestsORPCClient.reprocessImport({ id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: skinTestImportKeys.all });
      void queryClient.invalidateQueries({ queryKey: clinicalSeriesKeys.all });
    },
  });
}

export function useClinicalSkinTestJobStatus(jobId: string | null) {
  return useQuery({
    enabled: !!jobId,
    queryFn: async () => await clinicalSkinTestsORPCClient.jobStatus({ jobId: jobId! }),
    queryKey: [...skinTestImportKeys.all, "job-status", jobId],
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status;
      if (!status) return 2000;
      return ["completed", "failed"].includes(status) ? false : 2000;
    },
  });
}
