import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  oneDriveAccountStatusSchema,
  oneDriveFolderFileSchema,
  oneDriveFolderItemSchema,
} from "@finanzas/orpc-contracts/onedrive";
import type { z } from "zod";
import { onedriveORPCClient } from "../orpc";

// Shared OneDrive account / folder / webhook + snapshot-archive hooks. Backed by
// the generic /api/orpc/onedrive router, so every feature (tests cutáneos,
// fichas clínicas) drives OneDrive through one module — "todo lo que consuma
// OneDrive consume lo de OneDrive". The skin-test panel keeps its own copies for
// now; new consumers (fichas) use these.

export type OneDriveAccount = z.infer<typeof oneDriveAccountStatusSchema>;
export type OneDriveFolderItem = z.infer<typeof oneDriveFolderItemSchema>;
export type OneDriveFolderFile = z.infer<typeof oneDriveFolderFileSchema>;

export type OneDriveArchiveClassification = "SKIN_TEST" | "CLINICAL_DOCUMENT" | "OTHER";

export const oneDriveKeys = {
  all: ["onedrive"] as const,
  status: () => [...oneDriveKeys.all, "status"] as const,
  authUrl: (redirectUri: string) => [...oneDriveKeys.all, "auth-url", redirectUri] as const,
  folders: (accountId: string, driveId?: null | string, itemId?: null | string) =>
    [...oneDriveKeys.all, "folders", accountId, driveId ?? "root", itemId ?? "root"] as const,
  folderPreview: (accountId: string, driveId?: null | string, itemId?: null | string) =>
    [
      ...oneDriveKeys.all,
      "folder-preview",
      accountId,
      driveId ?? "root",
      itemId ?? "root",
    ] as const,
  archiveJob: () => [...oneDriveKeys.all, "archive-job"] as const,
};

export function useOneDriveStatus() {
  return useQuery({
    queryFn: async () => onedriveORPCClient.getOneDriveStatus({}),
    queryKey: oneDriveKeys.status(),
  });
}

export function useGetOneDriveAuthUrl(redirectUri: string) {
  return useQuery({
    enabled: false, // only run on demand
    queryFn: async () => onedriveORPCClient.getOneDriveAuthUrl({ redirectUri }),
    queryKey: oneDriveKeys.authUrl(redirectUri),
  });
}

export function useConnectOneDrive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { code: string; redirectUri: string }) =>
      onedriveORPCClient.connectOneDrive(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneDriveKeys.status() });
    },
  });
}

export function useDisconnectOneDrive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) =>
      await onedriveORPCClient.disconnectOneDrive({ accountId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneDriveKeys.status() });
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
    }) => await onedriveORPCClient.configureOneDriveFolder(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneDriveKeys.status() });
    },
  });
}

export function useRenewOneDriveSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) =>
      await onedriveORPCClient.renewOneDriveSubscription({ accountId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneDriveKeys.status() });
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
    queryFn: async () =>
      await onedriveORPCClient.listOneDriveFolderChildren({
        accountId: params.accountId,
        driveId: params.driveId,
        itemId: params.itemId,
      }),
    queryKey: oneDriveKeys.folders(params.accountId, params.driveId, params.itemId),
  });
}

export function useOneDriveFolderPreview(params: {
  accountId: string;
  driveId?: null | string;
  enabled?: boolean;
  itemId?: null | string;
}) {
  return useQuery({
    enabled: params.enabled ?? true,
    queryFn: async () =>
      await onedriveORPCClient.folderPreview({
        accountId: params.accountId,
        driveId: params.driveId,
        itemId: params.itemId,
      }),
    queryKey: oneDriveKeys.folderPreview(params.accountId, params.driveId, params.itemId),
  });
}

// ─── Shared snapshot-archive job (Phase C) ──────────────────────────────────

export function useStartArchiveSnapshots() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      classification?: OneDriveArchiveClassification;
      accountId?: string;
      force?: boolean;
    }) => await onedriveORPCClient.archiveSnapshots(params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneDriveKeys.archiveJob() });
    },
  });
}

export function useActiveArchiveJob(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: async () => await onedriveORPCClient.getActiveArchiveJob({}),
    queryKey: oneDriveKeys.archiveJob(),
    staleTime: 1000,
    refetchInterval: (query) => {
      if (query.state.status === "error") return 3000;
      const status = query.state.data?.job?.status;
      if (!status) return false;
      return ["completed", "failed", "cancelled"].includes(status) ? false : 2000;
    },
  });
}

export function useCancelArchiveJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => await onedriveORPCClient.cancelArchiveJob({ jobId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: oneDriveKeys.archiveJob() });
    },
  });
}
