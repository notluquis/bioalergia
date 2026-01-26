import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import {
  createService,
  extractErrorMessage,
  regenerateServiceSchedules,
  unlinkServicePayment,
} from "../api";
import { serviceKeys } from "../queries";
import { servicesActions } from "../store";
import type { CreateServicePayload, RegenerateServicePayload, ServiceListResponse } from "../types";

export function useServiceMutations() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const canManage = can("update", "Service");

  // Create
  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: (response) => {
      queryClient.setQueryData(serviceKeys.lists(), (old: ServiceListResponse | undefined) => {
        if (!old) return { services: [response.service], status: "ok" };
        return { ...old, services: [...old.services, response.service] };
      });
      // Invalidate both lists and detail (unifying cache is harder without normalized cache)
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.details() });

      servicesActions.setSelectedId(response.service.public_id);
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
  };
}
