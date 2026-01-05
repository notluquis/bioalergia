import { useFindManyCommonSupply, useFindManySupplyRequest, useUpdateSupplyRequest } from "@finanzas/db/hooks";
import { useState } from "react";

import { useToast } from "@/context/ToastContext";

import type { CommonSupply, StructuredSupplies, SupplyRequest } from "../types";

interface UseSupplyManagementResult {
  requests: SupplyRequest[];
  commonSupplies: CommonSupply[];
  loading: boolean;
  error: string | null;
  structuredSupplies: StructuredSupplies;
  fetchData: () => Promise<void>;
  handleStatusChange: (requestId: number, newStatus: SupplyRequest["status"]) => Promise<void>;
  setError: (error: string | null) => void;
}

export function useSupplyManagement(): UseSupplyManagementResult {
  const { success: toastSuccess, error: toastError } = useToast();
  const [error, setError] = useState<string | null>(null);

  // ZenStack hooks for supply requests
  const {
    data: requestsData,
    isPending: requestsPending,
    isFetching: requestsFetching,
    error: requestsError,
    refetch: refetchRequests,
  } = useFindManySupplyRequest({
    include: { inventoryItem: true },
    orderBy: { createdAt: "desc" },
  });

  // ZenStack hooks for common supplies
  const {
    data: commonSuppliesData,
    isPending: suppliesPending,
    isFetching: suppliesFetching,
    error: suppliesError,
    refetch: refetchSupplies,
  } = useFindManyCommonSupply({
    orderBy: { name: "asc" },
  });

  // Map requests to expected format with useMemo for stable reference
  // Map requests to expected format with useMemo for stable reference
  const requests = (() => {
    if (!requestsData) return [];
    return (requestsData as SupplyRequest[]).map((r) => ({
      ...r,
      item_id: (r as unknown as { inventoryItemId: number }).inventoryItemId,
      quantity: r.quantity,
      status: r.status,
      notes: r.notes,
    }));
  })();

  // Wrap commonSupplies in useMemo for stable reference
  const commonSupplies = (commonSuppliesData as CommonSupply[]) ?? [];

  const structuredSupplies = commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
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

  const fetchData = async () => {
    setError(null);
    await Promise.all([refetchRequests(), refetchSupplies()]);
  };

  // ZenStack mutation for updating supply request status
  // ZenStack mutation for updating supply request status
  const updateMutation = useUpdateSupplyRequest();

  const handleStatusChange = async (requestId: number, newStatus: SupplyRequest["status"]) => {
    setError(null);
    try {
      await updateMutation.mutateAsync({
        where: { id: requestId },
        data: { status: newStatus },
      });
      toastSuccess("Estado de solicitud actualizado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al actualizar el estado";
      setError(message);
      toastError(message);
    }
  };

  const loading = requestsPending || requestsFetching || suppliesPending || suppliesFetching;

  const combinedError =
    error ||
    (requestsError instanceof Error ? requestsError.message : null) ||
    (suppliesError instanceof Error ? suppliesError.message : null);

  return {
    requests,
    commonSupplies,
    loading,
    error: combinedError,
    structuredSupplies,
    fetchData,
    handleStatusChange,
    setError,
  };
}
