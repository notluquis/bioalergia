import type { ProductionBalance, ProductionBalancePayload } from "./types";

const safeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export function deriveTotals(
  payload: Pick<
    ProductionBalancePayload,
    "ingresoTarjetas" | "ingresoTransferencias" | "ingresoEfectivo" | "gastosDiarios" | "otrosAbonos"
  >
) {
  const subtotal =
    safeNumber(payload.ingresoTarjetas) +
    safeNumber(payload.ingresoTransferencias) +
    safeNumber(payload.ingresoEfectivo);
  const totalIngresos = subtotal - safeNumber(payload.gastosDiarios);
  const total = totalIngresos + safeNumber(payload.otrosAbonos);
  return { subtotal, totalIngresos, total };
}

export function formatActivityTotal(balance: ProductionBalance): number {
  return (
    safeNumber(balance.consultas) +
    safeNumber(balance.controles) +
    safeNumber(balance.tests) +
    safeNumber(balance.vacunas) +
    safeNumber(balance.licencias) +
    safeNumber(balance.roxair)
  );
}
