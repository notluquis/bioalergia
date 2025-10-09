import { useState, useEffect, useMemo, useCallback } from "react";
import { apiClient } from "../../../lib/apiClient";
import type { SupplyRequest, CommonSupply, StructuredSupplies } from "../types";

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
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [commonSupplies, setCommonSupplies] = useState<CommonSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const structuredSupplies = useMemo(() => {
    return commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
      if (!supply.name) return acc;
      if (!acc[supply.name]) {
        acc[supply.name] = {};
      }
      const brand = supply.brand || "N/A";
      if (!acc[supply.name][brand]) {
        acc[supply.name][brand] = [];
      }
      if (supply.model) {
        acc[supply.name][brand].push(supply.model);
      }
      return acc;
    }, {});
  }, [commonSupplies]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [requests, commonSupplies] = await Promise.all([
        apiClient.get<SupplyRequest[]>("/api/supplies/requests"),
        apiClient.get<CommonSupply[]>("/api/supplies/common"),
      ]);
      setRequests(requests);
      setCommonSupplies(commonSupplies);
    } catch (err: any) {
      setError(err.message || "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStatusChange = useCallback(
    async (requestId: number, newStatus: SupplyRequest["status"]) => {
      setError(null);
      setSuccessMessage(null);
      try {
        await apiClient.put(`/api/supplies/requests/${requestId}/status`, {
          status: newStatus,
        });
        setSuccessMessage("¡Estado de la solicitud actualizado con éxito!");
        fetchData(); // Refresh requests
      } catch (err: any) {
        setError(err.message || "Error al actualizar el estado");
      }
    },
    [fetchData]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    requests,
    commonSupplies,
    loading,
    error,
    successMessage,
    structuredSupplies,
    fetchData,
    handleStatusChange,
    setSuccessMessage,
    setError,
  };
}
