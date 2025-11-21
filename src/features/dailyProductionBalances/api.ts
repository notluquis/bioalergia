import type { ProductionBalance, ProductionBalanceHistoryEntry, ProductionBalancePayload } from "./types";

type ListResponse = {
  status: string;
  from: string;
  to: string;
  items: Array<{
    id: number;
    balanceDate: string;
    ingresoTarjetas: number;
    ingresoTransferencias: number;
    ingresoEfectivo: number;
    subtotalIngresos: number;
    gastosDiarios: number;
    totalIngresos: number;
    consultasCount: number;
    controlesCount: number;
    testsCount: number;
    vacunasCount: number;
    licenciasCount: number;
    roxairCount: number;
    otrosAbonos: number;
    total: number;
    comentarios: string | null;
    status: "DRAFT" | "FINAL";
    createdByEmail: string | null;
    updatedByEmail: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

type SaveResponse = {
  status: string;
  item: ListResponse["items"][number];
};

type HistoryResponse = {
  status: string;
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
  date: item.balanceDate,
  ingresoTarjetas: item.ingresoTarjetas,
  ingresoTransferencias: item.ingresoTransferencias,
  ingresoEfectivo: item.ingresoEfectivo,
  subtotalIngresos: item.subtotalIngresos,
  gastosDiarios: item.gastosDiarios,
  totalIngresos: item.totalIngresos,
  consultas: item.consultasCount,
  controles: item.controlesCount,
  tests: item.testsCount,
  vacunas: item.vacunasCount,
  licencias: item.licenciasCount,
  roxair: item.roxairCount,
  otrosAbonos: item.otrosAbonos,
  total: item.total,
  comentarios: item.comentarios,
  status: item.status,
  createdByEmail: item.createdByEmail,
  updatedByEmail: item.updatedByEmail,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export async function fetchProductionBalances(from: string, to: string): Promise<ProductionBalance[]> {
  const res = await fetch(
    `/api/daily-production-balances?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    {
      credentials: "include",
    }
  );
  if (!res.ok) {
    throw new Error("No se pudieron obtener los balances diarios de prestaciones");
  }
  const payload: ListResponse = await res.json();
  return (payload.items ?? []).map(asBalance);
}

export async function saveProductionBalance(
  payload: ProductionBalancePayload,
  id?: number | null
): Promise<ProductionBalance> {
  const method = id ? "PUT" : "POST";
  const url = id ? `/api/daily-production-balances/${id}` : "/api/daily-production-balances";
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(message || "No se pudo guardar el balance diario de prestaciones");
  }
  const data: SaveResponse = await res.json();
  return asBalance(data.item);
}

export async function fetchProductionBalanceHistory(balanceId: number): Promise<ProductionBalanceHistoryEntry[]> {
  const res = await fetch(`/api/daily-production-balances/${balanceId}/history`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error("No se pudo cargar el historial del balance");
  }
  const payload: HistoryResponse = await res.json();
  return (payload.items ?? []).map((entry) => ({
    id: entry.id,
    balanceId: entry.balanceId,
    snapshot: entry.snapshot ? asBalance(entry.snapshot) : null,
    changeReason: entry.changeReason,
    changedByEmail: entry.changedByEmail,
    createdAt: entry.createdAt,
  }));
}
