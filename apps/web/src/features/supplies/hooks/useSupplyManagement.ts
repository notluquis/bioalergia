import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { useToast } from "@/context/ToastContext";

import { updateSupplyRequestStatus } from "../api";
import { supplyKeys, supplyQueries } from "../queries";
import type { CommonSupply, StructuredSupplies, SupplyRequest } from "../types";

interface UseSupplyManagementResult {
  requests: SupplyRequest[];
  commonSupplies: CommonSupply[];
  structuredSupplies: StructuredSupplies;
  handleStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSupplyManagement(): UseSupplyManagementResult {
  const { success: toastSuccess, error: toastError } = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch Requests (Suspense-enabled for Loaders)
  const { data: requests } = useSuspenseQuery(supplyQueries.requests());

  // 2. Fetch Common Supplies
  const { data: commonSupplies } = useSuspenseQuery(supplyQueries.common());

  // 3. Process Data (Memoization handled by React 19 Compiler or fast enough for now)
  const structuredSupplies: StructuredSupplies = commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
    if (!supply.name) return acc;
    if (!acc[supply.name]) {
      acc[supply.name] = {};
    }
    const brand = supply.brand || "N/A";
    if (!acc[supply.name]![brand]) {
      acc[supply.name]![brand] = [];
    }
    if (supply.model) {
      acc[supply.name]![brand]!.push(supply.model);
    }
    return acc;
  }, {});

  // 4. Mutations
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: SupplyRequest["status"] }) => {
      return updateSupplyRequestStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplyKeys.requests() });
      toastSuccess("Estado de solicitud actualizado");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al actualizar el estado";
      toastError(message);
    },
  });

  const handleStatusChange = async (requestId: number, newStatus: SupplyRequest["status"]) => {
    await updateMutation.mutateAsync({ id: requestId, status: newStatus });
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: supplyKeys.requests() }),
      queryClient.invalidateQueries({ queryKey: supplyKeys.common() }),
    ]);
  };

  return {
    requests,
    commonSupplies,
    structuredSupplies,
    handleStatusChange,
    refresh,
  };
}
