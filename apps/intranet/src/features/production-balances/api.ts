import { z } from "zod";
import { parseOrThrow, zApiDateOnly, zStatusOk } from "@/lib/api-validate";
import { productionBalancesORPCClient, toProductionBalancesApiError } from "./orpc";

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

const ProductionBalanceApiItemSchema = z.strictObject({
  changeReason: z.string().nullable(),
  comentarios: z.string().nullable(),
  consultasMonto: z.number(),
  controlesMonto: z.number(),
  createdAt: z.coerce.date(),
  createdByEmail: z.string().nullable(),
  date: zApiDateOnly,
  gastosDiarios: z.number(),
  id: z.number(),
  ingresoEfectivo: z.number(),
  ingresoTarjetas: z.number(),
  ingresoTransferencias: z.number(),
  licenciasMonto: z.number(),
  otrosAbonos: z.number(),
  roxairMonto: z.number(),
  status: z.string(),
  subtotalIngresos: z.number().optional(),
  testsMonto: z.number(),
  total: z.number().optional(),
  totalIngresos: z.number().optional(),
  updatedAt: z.coerce.date(),
  updatedByEmail: z.string().nullable(),
  vacunasMonto: z.number(),
});

const ApiListResponseSchema = z.strictObject({
  from: zApiDateOnly,
  items: z.array(ProductionBalanceApiItemSchema),
  status: zStatusOk.shape.status,
  to: zApiDateOnly,
});

const ApiSuccessResponseSchema = z.strictObject({
  item: ProductionBalanceApiItemSchema,
  status: zStatusOk.shape.status,
});

export const dailyBalanceApi = {
  createBalance: async (data: DailyBalancePayload) => {
    try {
      const response = await productionBalancesORPCClient.create(data);
      return parseOrThrow(
        ApiSuccessResponseSchema,
        response,
        "Respuesta inválida al crear balance diario",
      );
    } catch (error) {
      throw toProductionBalancesApiError(error);
    }
  },

  getBalances: async (from: string, to: string) => {
    try {
      const response = await productionBalancesORPCClient.list({ from, to });
      return parseOrThrow(
        ApiListResponseSchema,
        response,
        "Respuesta inválida al listar balances diarios",
      );
    } catch (error) {
      throw toProductionBalancesApiError(error);
    }
  },

  updateBalance: async (id: number, data: DailyBalancePayload) => {
    try {
      const response = await productionBalancesORPCClient.update({ id, ...data });
      return parseOrThrow(
        ApiSuccessResponseSchema,
        response,
        "Respuesta inválida al actualizar balance diario",
      );
    } catch (error) {
      throw toProductionBalancesApiError(error);
    }
  },
};
