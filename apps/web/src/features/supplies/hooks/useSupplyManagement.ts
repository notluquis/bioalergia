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
    // Note: SupplyRequest model doesn't have inventoryItem relation
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

  // Map requests from ZenStack camelCase to frontend snake_case format
  type ZenStackRequest = NonNullable<typeof requestsData>[number];
  const requests: SupplyRequest[] = (requestsData ?? []).map((r: ZenStackRequest) => ({
    id: r.id,
    supply_name: r.supplyName,
    quantity: r.quantity,
    brand: r.brand ?? undefined,
    model: r.model ?? undefined,
    notes: r.notes ?? undefined,
    status: r.status.toLowerCase() as SupplyRequest["status"],
    created_at: (r as { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
  }));

  // Map common supplies
  type ZenStackSupply = NonNullable<typeof commonSuppliesData>[number];
  const commonSupplies: CommonSupply[] = (commonSuppliesData ?? []).map((s: ZenStackSupply) => ({
    id: s.id,
    name: s.name,
    brand: s.brand ?? undefined,
    model: s.model ?? undefined,
  }));

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
    } catch (error_) {
      const message = error_ instanceof Error ? error_.message : "Error al actualizar el estado";
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
