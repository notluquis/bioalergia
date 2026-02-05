import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { parseOrThrow, zDateString, zStatusOk } from "@/lib/api-validate";

export interface DailyBalancePayload {
  date: string;
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
  date: string;
  changeReason: null | string;
  // total?
  comentarios: null | string;
  consultasMonto: number; // was consultas
  controlesMonto: number; // was controles
  createdAt: Date;
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
  updatedAt: Date;
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

const ProductionBalanceApiItemSchema = z.strictObject({
  balanceDate: z.undefined().optional(),
  changeReason: z.string().nullable(),
  comentarios: z.string().nullable(),
  consultasMonto: z.number(),
  controlesMonto: z.number(),
  createdAt: z.coerce.date(),
  createdByEmail: z.string().nullable(),
  date: zDateString,
  gastosDiarios: z.number(),
  id: z.number(),
  ingresoEfectivo: z.number(),
  ingresoTarjetas: z.number(),
  ingresoTransferencias: z.number(),
  licenciasMonto: z.number(),
  otrosAbonos: z.number(),
  roxairMonto: z.number(),
  status: z.string(),
  testsMonto: z.number(),
  updatedAt: z.coerce.date(),
  updatedByEmail: z.string().nullable(),
  vacunasMonto: z.number(),
});

const ApiListResponseSchema = z.strictObject({
  from: zDateString,
  items: z.array(ProductionBalanceApiItemSchema),
  status: zStatusOk.shape.status,
  to: zDateString,
});

const ApiSuccessResponseSchema = z.strictObject({
  item: ProductionBalanceApiItemSchema,
  status: zStatusOk.shape.status,
});

export const dailyBalanceApi = {
  createBalance: async (data: DailyBalancePayload) => {
    const response = await apiClient.post<ApiSuccessResponse<ProductionBalanceApiItem>>(
      "/api/daily-production-balances",
      data,
      { responseSchema: ApiSuccessResponseSchema },
    );
    return parseOrThrow(
      ApiSuccessResponseSchema,
      response,
      "Respuesta inválida al crear balance diario",
    );
  },

  getBalances: async (from: string, to: string) => {
    const response = await apiClient.get<ApiListResponse<ProductionBalanceApiItem>>(
      `/api/daily-production-balances?from=${from}&to=${to}`,
      { responseSchema: ApiListResponseSchema },
    );
    return parseOrThrow(
      ApiListResponseSchema,
      response,
      "Respuesta inválida al listar balances diarios",
    );
  },

  updateBalance: async (id: number, data: DailyBalancePayload) => {
    const response = await apiClient.put<ApiSuccessResponse<ProductionBalanceApiItem>>(
      `/api/daily-production-balances/${id}`,
      data,
      { responseSchema: ApiSuccessResponseSchema },
    );
    return parseOrThrow(
      ApiSuccessResponseSchema,
      response,
      "Respuesta inválida al actualizar balance diario",
    );
  },
};
