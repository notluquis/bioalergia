import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupplyRequest, CommonSupply, StructuredSupplies } from "../types";
import { getCommonSupplies, getSupplyRequests, updateSupplyRequestStatus } from "../api";
import { queryKeys } from "../../../lib/queryKeys";
import { useToast } from "../../../context/ToastContext";

interface UseSupplyManagementResult {
  requests: SupplyRequest[];
  commonSupplies: CommonSupply[];
  loading: boolean;
  error: string | null;
  successMessage: string | null;
  structuredSupplies: StructuredSupplies;
  fetchData: () => Promise<void>;
  handleStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => Promise<void>;
  setSuccessMessage: (message: string | null) => void;
  setError: (error: string | null) => void;
}

export function useSupplyManagement(): UseSupplyManagementResult {
  const queryClient = useQueryClient();
  const { success: toastSuccess, error: toastError } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const requestsQuery = useQuery<SupplyRequest[], Error>({
    queryKey: queryKeys.supplies.requests(),
    queryFn: getSupplyRequests,
    staleTime: 2 * 60 * 1000,
  });

  const commonSuppliesQuery = useQuery<CommonSupply[], Error>({
    queryKey: queryKeys.supplies.common(),
    queryFn: getCommonSupplies,
    staleTime: 5 * 60 * 1000,
  });

  const structuredSupplies = useMemo(() => {
    const supplies = commonSuppliesQuery.data ?? [];
    return supplies.reduce<StructuredSupplies>((acc, supply) => {
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
  }, [commonSuppliesQuery.data]);

  const fetchData = useCallback(async () => {
    setError(null);
    await Promise.all([requestsQuery.refetch(), commonSuppliesQuery.refetch()]);
  }, [requestsQuery, commonSuppliesQuery]);

  const updateStatusMutation = useMutation<
    void,
    Error,
    { requestId: number; status: SupplyRequest["status"] },
    { previousRequests?: SupplyRequest[] }
  >({
    mutationFn: ({ requestId, status }) => updateSupplyRequestStatus(requestId, status),
    onMutate: async ({ requestId, status }) => {
      setError(null);
      setSuccessMessage(null);
      await queryClient.cancelQueries({ queryKey: queryKeys.supplies.requests() });
      const previousRequests = queryClient.getQueryData<SupplyRequest[]>(queryKeys.supplies.requests());
      queryClient.setQueryData<SupplyRequest[]>(queryKeys.supplies.requests(), (old = []) =>
        old.map((request) => (request.id === requestId ? { ...request, status } : request))
      );
      return { previousRequests };
    },
    onError: (err, _variables, context) => {
      const message = err.message || "Error al actualizar el estado";
      setError(message);
      toastError(message);
      if (context?.previousRequests) {
        queryClient.setQueryData(queryKeys.supplies.requests(), context.previousRequests);
      }
    },
    onSuccess: () => {
      setSuccessMessage("¡Estado de la solicitud actualizado con éxito!");
      toastSuccess("Estado de solicitud actualizado");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.supplies.requests() });
    },
  });

  const handleStatusChange = useCallback(
    async (requestId: number, newStatus: SupplyRequest["status"]) => {
      try {
        await updateStatusMutation.mutateAsync({ requestId, status: newStatus });
      } catch {
        // Error handled in mutation
      }
    },
    [updateStatusMutation]
  );

  const loading =
    requestsQuery.isPending ||
    requestsQuery.isFetching ||
    commonSuppliesQuery.isPending ||
    commonSuppliesQuery.isFetching;

  const combinedError =
    error ||
    (requestsQuery.error ? requestsQuery.error.message : null) ||
    (commonSuppliesQuery.error ? commonSuppliesQuery.error.message : null);

  return {
    requests: requestsQuery.data ?? [],
    commonSupplies: commonSuppliesQuery.data ?? [],
    loading,
    error: combinedError,
    successMessage,
    structuredSupplies,
    fetchData,
    handleStatusChange,
    setSuccessMessage,
    setError,
  };
}
