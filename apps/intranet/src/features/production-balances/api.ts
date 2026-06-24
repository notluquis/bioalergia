import type {
  ProductionBalanceItem,
  ProductionBalanceStatus,
} from "@finanzas/orpc-contracts/production-balances";
import { productionBalancesORPCClient, toProductionBalancesApiError } from "./orpc";

export type { ProductionBalanceItem, ProductionBalanceStatus };

export interface DailyBalancePayload {
  date: string;
  comentarios: string;
  consultasMonto: number;
  gastosDiarios: number;
  controlesMonto: number;
  ingresoEfectivo: number;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  licenciasMonto: number;
  otrosAbonos: number;
  roxairMonto: number;
  status: ProductionBalanceStatus;
  testsMonto: number;
  vacunasMonto: number;
}

// El backend valida el output contra el contrato oRPC (productionBalanceItemSchema),
// así que acá no se re-valida: el strictObject espejo que vivía en este archivo
// reventaba ante cualquier campo nuevo legal del contrato (.passthrough()).
function toProductionBalancePayload(data: DailyBalancePayload) {
  return {
    comentarios: data.comentarios,
    consultas: data.consultasMonto,
    controles: data.controlesMonto,
    date: data.date,
    gastosDiarios: data.gastosDiarios,
    ingresoEfectivo: data.ingresoEfectivo,
    ingresoTarjetas: data.ingresoTarjetas,
    ingresoTransferencias: data.ingresoTransferencias,
    licencias: data.licenciasMonto,
    otrosAbonos: data.otrosAbonos,
    roxair: data.roxairMonto,
    status: data.status,
    tests: data.testsMonto,
    vacunas: data.vacunasMonto,
  };
}

export const dailyBalanceApi = {
  createBalance: async (data: DailyBalancePayload) => {
    try {
      return await productionBalancesORPCClient.create(toProductionBalancePayload(data));
    } catch (error) {
      throw toProductionBalancesApiError(error);
    }
  },

  getBalances: async (from: string, to: string) => {
    try {
      return await productionBalancesORPCClient.list({ from, to });
    } catch (error) {
      throw toProductionBalancesApiError(error);
    }
  },

  updateBalance: async (id: number, data: DailyBalancePayload) => {
    try {
      return await productionBalancesORPCClient.update({
        id,
        ...toProductionBalancePayload(data),
      });
    } catch (error) {
      throw toProductionBalancesApiError(error);
    }
  },
};
