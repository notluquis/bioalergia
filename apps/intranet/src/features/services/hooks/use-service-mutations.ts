import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import {
  createService,
  editServiceSchedule,
  extractErrorMessage,
  regenerateServiceSchedules,
  skipServiceSchedule,
  syncAllServiceTransactions,
  syncServiceTransactions,
  unlinkServicePayment,
} from "../api";
import { serviceKeys } from "../queries";
import { servicesActions } from "../store";
import type {
  CreateServicePayload,
  RegenerateServicePayload,
  ServiceListResponse,
  ServiceScheduleEditPayload,
  ServiceScheduleSkipPayload,
  ServiceSyncTransactionsResult,
} from "../types";

export function useServiceMutations() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Service");

  // Create
  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: (response) => {
      queryClient.setQueryData(serviceKeys.lists(), (old: ServiceListResponse | undefined) => {
        if (!old) {
          return { services: [response.service], status: "ok" };
        }
        return { ...old, services: [...old.services, response.service] };
      });
      // Invalidate both lists and detail (unifying cache is harder without normalized cache)
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });

      servicesActions.setSelectedId(response.service.publicId);
      servicesActions.closeCreateModal();
    },
  });

  // Regenerate
  const regenerateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: RegenerateServicePayload }) => {
      return regenerateServiceSchedules(id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
    },
  });

  // Unlink
  const unlinkMutation = useMutation({
    mutationFn: unlinkServicePayment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
    },
  });

  // Edit Schedule
  const editScheduleMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ServiceScheduleEditPayload }) => {
      return editServiceSchedule(id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
      servicesActions.closeEditScheduleModal();
    },
  });

  // Skip Schedule
  const skipScheduleMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ServiceScheduleSkipPayload }) => {
      return skipServiceSchedule(id, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
      servicesActions.closeSkipScheduleModal();
    },
  });

  // Sync financial transactions
  const syncAllTransactionsMutation = useMutation({
    mutationFn: syncAllServiceTransactions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
    },
  });

  const syncServiceTransactionsMutation = useMutation({
    mutationFn: syncServiceTransactions,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });
    },
  });

  return {
    // State
    canManage,
    createError: extractErrorMessage(createMutation.error),
    createPending: createMutation.isPending,

    // Methods
    createService: async (payload: CreateServicePayload) => {
      await createMutation.mutateAsync(payload);
    },
    regenerateError: extractErrorMessage(regenerateMutation.error),
    regeneratePending: regenerateMutation.isPending,
    regenerateService: async (id: string, overrides: RegenerateServicePayload) => {
      await regenerateMutation.mutateAsync({ id, payload: overrides });
    },
    unlinkError: extractErrorMessage(unlinkMutation.error),
    unlinkPayment: async (scheduleId: number) => {
      await unlinkMutation.mutateAsync(scheduleId);
    },
    unlinkPending: unlinkMutation.isPending,

    // Edit Schedule
    editSchedule: async (scheduleId: number, payload: ServiceScheduleEditPayload) => {
      await editScheduleMutation.mutateAsync({ id: scheduleId, payload });
    },
    editScheduleError: extractErrorMessage(editScheduleMutation.error),
    editSchedulePending: editScheduleMutation.isPending,

    // Skip Schedule
    skipSchedule: async (scheduleId: number, payload: ServiceScheduleSkipPayload) => {
      await skipScheduleMutation.mutateAsync({ id: scheduleId, payload });
    },
    skipScheduleError: extractErrorMessage(skipScheduleMutation.error),
    skipSchedulePending: skipScheduleMutation.isPending,

    syncAllTransactions: async () => {
      return await syncAllTransactionsMutation.mutateAsync();
    },
    syncAllTransactionsPending: syncAllTransactionsMutation.isPending,
    syncServiceTransactions: async (publicId: string): Promise<ServiceSyncTransactionsResult> => {
      return await syncServiceTransactionsMutation.mutateAsync(publicId);
    },
    syncServiceTransactionsPending: syncServiceTransactionsMutation.isPending,
  };
}
