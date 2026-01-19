import { apiClient } from "@/lib/api-client";

export interface DailyBalancePayload {
  balanceDate: string;
  comentarios: string;
  consultasMonto: number;
  controlesMonto: number;
  createdBy?: number;
  gastosDiarios: number;
  ingresoEfectivo: number;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  licenciasMonto: number;
  otrosAbonos: number;
  roxairMonto: number;
  testsMonto: number;
  vacunasMonto: number;
}

// Result from GET /api/daily-production-balances
// Result from GET /api/daily-production-balances
export interface ProductionBalanceApiItem {
  balanceDate: string; // was date
  changeReason: null | string;
  // total?
  comentarios: null | string;
  consultasMonto: number; // was consultas
  controlesMonto: number; // was controles
  createdAt: string;
  createdByEmail: null | string; // This likely comes from "include: { user: true }" ??? Or maybe not sent?
  // subtotalIngresos? Maybe calculated on backend or frontend? Keep if unsure but backend might not send it.
  gastosDiarios: number;
  id: number;
  ingresoEfectivo: number;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  licenciasMonto: number; // was licencias
  // totalIngresos?
  otrosAbonos: number;
  roxairMonto: number; // was roxair
  status: string; // "PENDING", "COMPLETED", etc.
  testsMonto: number; // was tests
  updatedAt: string;
  updatedByEmail: null | string;
  vacunasMonto: number; // was vacunas
}

interface ApiListResponse<T> {
  from: string;
  items: T[];
  status: "ok";
  to: string;
}

interface ApiSuccessResponse<T> {
  item: T;
  status: "ok";
}

export const dailyBalanceApi = {
  createBalance: async (data: DailyBalancePayload) => {
    return apiClient.post<ApiSuccessResponse<ProductionBalanceApiItem>>(
      "/api/daily-production-balances",
      data,
    );
  },

  getBalances: async (from: string, to: string) => {
    return apiClient.get<ApiListResponse<ProductionBalanceApiItem>>(
      `/api/daily-production-balances?from=${from}&to=${to}`,
    );
  },

  updateBalance: async (id: number, data: DailyBalancePayload) => {
    return apiClient.put<ApiSuccessResponse<ProductionBalanceApiItem>>(
      `/api/daily-production-balances/${id}`,
      data,
    );
  },
};
