export type ProductionBalanceStatus = "DRAFT" | "FINAL";

export type ProductionBalance = {
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
  status: ProductionBalanceStatus;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBalanceHistoryEntry = {
  id: number;
  balanceId: number;
  snapshot: ProductionBalance | null;
  changeReason: string | null;
  changedByEmail: string | null;
  createdAt: string;
};

export type ProductionBalancePayload = {
  date: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  gastosDiarios: number;
  otrosAbonos: number;
  consultas: number;
  controles: number;
  tests: number;
  vacunas: number;
  licencias: number;
  roxair: number;
  comentarios?: string | null;
  status: ProductionBalanceStatus;
  reason?: string | null;
};
