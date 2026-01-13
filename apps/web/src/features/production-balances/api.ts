import { apiClient } from "@/lib/apiClient";

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
// Result from GET /api/daily-production-balances
export interface ProductionBalanceApiItem {
  id: number;
  balanceDate: string; // was date
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  // subtotalIngresos? Maybe calculated on backend or frontend? Keep if unsure but backend might not send it.
  gastosDiarios: number;
  // totalIngresos?
  otrosAbonos: number;
  consultasMonto: number; // was consultas
  controlesMonto: number; // was controles
  testsMonto: number; // was tests
  vacunasMonto: number; // was vacunas
  licenciasMonto: number; // was licencias
  roxairMonto: number; // was roxair
  // total?
  comentarios: string | null;
  status: string; // "PENDING", "COMPLETED", etc.
  changeReason: string | null;
  createdByEmail: string | null; // This likely comes from "include: { user: true }" ??? Or maybe not sent?
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBalancePayload {
  balanceDate: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  gastosDiarios: number;
  otrosAbonos: number;
  comentarios: string;
  consultasMonto: number;
  controlesMonto: number;
  testsMonto: number;
  vacunasMonto: number;
  licenciasMonto: number;
  roxairMonto: number;
  createdBy?: number;
}

export const dailyBalanceApi = {
  getBalances: async (from: string, to: string) => {
    return apiClient.get<ApiListResponse<ProductionBalanceApiItem>>(
      `/api/daily-production-balances?from=${from}&to=${to}`
    );
  },

  createBalance: async (data: DailyBalancePayload) => {
    return apiClient.post<ApiSuccessResponse<ProductionBalanceApiItem>>("/api/daily-production-balances", data);
  },

  updateBalance: async (id: number, data: DailyBalancePayload) => {
    return apiClient.put<ApiSuccessResponse<ProductionBalanceApiItem>>(`/api/daily-production-balances/${id}`, data);
  },
};
