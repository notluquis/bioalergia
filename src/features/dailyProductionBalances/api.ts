import { apiClient } from "@/lib/apiClient";

import type { ProductionBalance, ProductionBalanceHistoryEntry, ProductionBalancePayload } from "./types";

type ListResponse = {
  status: string;
  from: string;
  to: string;
  message?: string;
  items: Array<{
    id: number;
    date: string;
    ingresoTarjetas: number;
    ingresoTransferencias: number;
    ingresoEfectivo: number;
    subtotalIngresos: number;
    gastosDiarios: number;
    totalIngresos: number;
    consultas: number;
    controles: number;
    tests: number;
    vacunas: number;
    licencias: number;
    roxair: number;
    otrosAbonos: number;
    total: number;
    comentarios: string | null;
    changeReason?: string | null;
    status: "DRAFT" | "FINAL";
    createdByEmail: string | null;
    updatedByEmail: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type SaveResponse = {
  status: string;
  message?: string;
  item: ListResponse["items"][number];
};

type HistoryResponse = {
  status: string;
  message?: string;
  items: Array<{
    id: number;
    balanceId: number;
    snapshot: ListResponse["items"][number] | null;
    changedByEmail: string | null;
    changeReason: string | null;
    createdAt: string;
  }>;
};

const asBalance = (item: ListResponse["items"][number]): ProductionBalance => ({
  id: item.id,
  date: item.date,
  ingresoTarjetas: item.ingresoTarjetas,
  ingresoTransferencias: item.ingresoTransferencias,
  ingresoEfectivo: item.ingresoEfectivo,
  subtotalIngresos: item.subtotalIngresos,
  gastosDiarios: item.gastosDiarios,
  totalIngresos: item.totalIngresos,
  consultas: item.consultas,
  controles: item.controles,
  tests: item.tests,
  vacunas: item.vacunas,
  licencias: item.licencias,
  roxair: item.roxair,
  otrosAbonos: item.otrosAbonos,
  total: item.total,
  comentarios: item.comentarios,
  changeReason: item.changeReason,
  status: item.status,
  createdByEmail: item.createdByEmail,
  updatedByEmail: item.updatedByEmail,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export async function fetchProductionBalances(from: string, to: string): Promise<ProductionBalance[]> {
  const payload = await apiClient.get<ListResponse>("/api/daily-production-balances", {
    query: { from, to },
  });

  if (payload.status !== "ok") {
    throw new Error(payload.message || "No se pudieron obtener los balances diarios de prestaciones");
  }
  return (payload.items ?? []).map(asBalance);
}

export async function saveProductionBalance(
  payload: ProductionBalancePayload,
  id?: number | null
): Promise<ProductionBalance> {
  const url = id ? `/api/daily-production-balances/${id}` : "/api/daily-production-balances";
  const data = await (id ? apiClient.put<SaveResponse>(url, payload) : apiClient.post<SaveResponse>(url, payload));

  if (data.status !== "ok") {
    throw new Error(data.message || "No se pudo guardar el balance diario de prestaciones");
  }
  return asBalance(data.item);
}

export async function fetchProductionBalanceHistory(balanceId: number): Promise<ProductionBalanceHistoryEntry[]> {
  const payload = await apiClient.get<HistoryResponse>(`/api/daily-production-balances/${balanceId}/history`);

  if (payload.status !== "ok") {
    throw new Error(payload.message || "No se pudo cargar el historial del balance");
  }
  return (payload.items ?? []).map((entry) => ({
    id: entry.id,
    balanceId: entry.balanceId,
    snapshot: entry.snapshot ? asBalance(entry.snapshot) : null,
    changeReason: entry.changeReason,
    changedByEmail: entry.changedByEmail,
    createdAt: entry.createdAt,
  }));
}
