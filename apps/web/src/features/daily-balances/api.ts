import { apiClient } from "@/lib/apiClient";

import type { DailyBalanceFormData } from "./types";

interface ApiSuccessResponse<T> {
  status: "ok";
  item: T;
}

interface ApiListResponse<T> {
  status: "ok";
  items: T[];
  from: string;
  to: string;
}

// Result from GET /api/daily-production-balances
export interface ProductionBalanceApiItem {
  id: number;
  date: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  subtotalIngresos: number;
  gastosDiarios: number;
  totalIngresos: number;
  otrosAbonos: number;
  consultas: number;
  controles: number;
  tests: number;
  vacunas: number;
  licencias: number;
  roxair: number;
  total: number;
  comentarios: string | null;
  status: string; // "PENDING", "COMPLETED", etc.
  changeReason: string | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export const dailyBalanceApi = {
  getBalances: async (from: string, to: string) => {
    return apiClient.get<ApiListResponse<ProductionBalanceApiItem>>(
      `/api/daily-production-balances?from=${from}&to=${to}`
    );
  },

  createBalance: async (data: DailyBalanceFormData & { date: string }) => {
    return apiClient.post<ApiSuccessResponse<ProductionBalanceApiItem>>("/api/daily-production-balances", data);
  },

  updateBalance: async (id: number, data: DailyBalanceFormData & { date: string }) => {
    return apiClient.put<ApiSuccessResponse<ProductionBalanceApiItem>>(`/api/daily-production-balances/${id}`, data);
  },
};
