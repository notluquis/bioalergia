import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client";
import dayjs from "dayjs";

export type ProductionBalanceStatus = "DRAFT" | "FINAL";

export type ProductionBalanceRecord = {
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
  status: ProductionBalanceStatus;
  createdBy: number;
  updatedBy: number | null;
  createdByEmail: string | null;
  updatedByEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductionBalanceHistoryEntry = {
  id: number;
  balanceId: number;
  snapshot: ProductionBalanceRecord | null;
  changeReason: string | null;
  changedBy: number | null;
  changedByEmail: string | null;
  createdAt: string;
};

export type ProductionBalancePayload = {
  balanceDate: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  gastosDiarios: number;
  otrosAbonos: number;
  consultasCount: number;
  controlesCount: number;
  testsCount: number;
  vacunasCount: number;
  licenciasCount: number;
  roxairCount: number;
  comentarios: string | null;
  status: ProductionBalanceStatus;
  changeReason?: string | null;
};

export type ListProductionBalanceOptions = {
  from: string;
  to: string;
};

const asInt = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.round(num);
};

function computeTotals(payload: ProductionBalancePayload) {
  const subtotalIngresos =
    asInt(payload.ingresoTarjetas) + asInt(payload.ingresoTransferencias) + asInt(payload.ingresoEfectivo);
  const totalIngresos = subtotalIngresos - asInt(payload.gastosDiarios);
  const total = totalIngresos + asInt(payload.otrosAbonos);

  return {
    subtotalIngresos,
    totalIngresos,
    total,
  };
}

// Define the Prisma payload type with relations included
type BalanceWithRelations = Prisma.DailyProductionBalanceGetPayload<{
  include: {
    creator: { select: { email: true } };
    updater: { select: { email: true } };
  };
}>;

function mapBalanceRecord(balance: BalanceWithRelations): ProductionBalanceRecord {
  return {
    id: Number(balance.id),
    balanceDate: dayjs(balance.balanceDate).format("YYYY-MM-DD"),
    ingresoTarjetas: balance.ingresoTarjetas,
    ingresoTransferencias: balance.ingresoTransferencias,
    ingresoEfectivo: balance.ingresoEfectivo,
    subtotalIngresos: balance.subtotalIngresos,
    gastosDiarios: balance.gastosDiarios,
    totalIngresos: balance.totalIngresos,
    consultasCount: balance.consultasCount,
    controlesCount: balance.controlesCount,
    testsCount: balance.testsCount,
    vacunasCount: balance.vacunasCount,
    licenciasCount: balance.licenciasCount,
    roxairCount: balance.roxairCount,
    otrosAbonos: balance.otrosAbonos,
    total: balance.total,
    comentarios: balance.comentarios,
    status: balance.status as ProductionBalanceStatus,
    createdBy: balance.createdBy,
    updatedBy: balance.updatedBy,
    createdByEmail: balance.creator?.email ?? null,
    updatedByEmail: balance.updater?.email ?? null,
    createdAt: balance.createdAt.toISOString(),
    updatedAt: balance.updatedAt.toISOString(),
  };
}

export async function listProductionBalances(
  options: ListProductionBalanceOptions
): Promise<ProductionBalanceRecord[]> {
  const balances = await prisma.dailyProductionBalance.findMany({
    where: {
      balanceDate: {
        gte: new Date(options.from),
        lte: new Date(options.to),
      },
    },
    include: {
      creator: { select: { email: true } },
      updater: { select: { email: true } },
    },
    orderBy: [{ balanceDate: "desc" }, { id: "desc" }],
    take: 500,
  });

  return balances.map(mapBalanceRecord);
}

export async function getProductionBalanceById(id: number): Promise<ProductionBalanceRecord | null> {
  const balance = await prisma.dailyProductionBalance.findUnique({
    where: { id: BigInt(id) },
    include: {
      creator: { select: { email: true } },
      updater: { select: { email: true } },
    },
  });

  return balance ? mapBalanceRecord(balance) : null;
}

export async function createProductionBalance(
  payload: ProductionBalancePayload,
  userId: number
): Promise<ProductionBalanceRecord> {
  const totals = computeTotals(payload);

  const balance = await prisma.dailyProductionBalance.create({
    data: {
      balanceDate: new Date(payload.balanceDate),
      ingresoTarjetas: asInt(payload.ingresoTarjetas),
      ingresoTransferencias: asInt(payload.ingresoTransferencias),
      ingresoEfectivo: asInt(payload.ingresoEfectivo),
      subtotalIngresos: totals.subtotalIngresos,
      gastosDiarios: asInt(payload.gastosDiarios),
      totalIngresos: totals.totalIngresos,
      consultasCount: asInt(payload.consultasCount),
      controlesCount: asInt(payload.controlesCount),
      testsCount: asInt(payload.testsCount),
      vacunasCount: asInt(payload.vacunasCount),
      licenciasCount: asInt(payload.licenciasCount),
      roxairCount: asInt(payload.roxairCount),
      otrosAbonos: asInt(payload.otrosAbonos),
      total: totals.total,
      comentarios: payload.comentarios,
      status: payload.status,
      createdBy: userId,
      updatedBy: userId,
    },
    include: {
      creator: { select: { email: true } },
      updater: { select: { email: true } },
    },
  });

  return mapBalanceRecord(balance);
}

export async function updateProductionBalance(
  id: number,
  payload: ProductionBalancePayload,
  userId: number
): Promise<ProductionBalanceRecord> {
  const existing = await getProductionBalanceById(id);
  if (!existing) {
    throw new Error("Balance no encontrado");
  }

  const totals = computeTotals(payload);

  // Use a transaction to create history and update balance
  const updated = await prisma.$transaction(async (tx) => {
    // Create history entry
    await tx.dailyProductionBalanceHistory.create({
      data: {
        balanceId: BigInt(id),
        snapshot: existing as unknown as Prisma.InputJsonValue,
        changeReason: payload.changeReason ?? null,
        changedBy: userId,
      },
    });

    // Update balance
    const balance = await tx.dailyProductionBalance.update({
      where: { id: BigInt(id) },
      data: {
        balanceDate: new Date(payload.balanceDate),
        ingresoTarjetas: asInt(payload.ingresoTarjetas),
        ingresoTransferencias: asInt(payload.ingresoTransferencias),
        ingresoEfectivo: asInt(payload.ingresoEfectivo),
        subtotalIngresos: totals.subtotalIngresos,
        gastosDiarios: asInt(payload.gastosDiarios),
        totalIngresos: totals.totalIngresos,
        consultasCount: asInt(payload.consultasCount),
        controlesCount: asInt(payload.controlesCount),
        testsCount: asInt(payload.testsCount),
        vacunasCount: asInt(payload.vacunasCount),
        licenciasCount: asInt(payload.licenciasCount),
        roxairCount: asInt(payload.roxairCount),
        otrosAbonos: asInt(payload.otrosAbonos),
        total: totals.total,
        comentarios: payload.comentarios,
        status: payload.status,
        updatedBy: userId,
      },
      include: {
        creator: { select: { email: true } },
        updater: { select: { email: true } },
      },
    });

    return balance;
  });

  return mapBalanceRecord(updated);
}

export async function listProductionBalanceHistory(balanceId: number): Promise<ProductionBalanceHistoryEntry[]> {
  const entries = await prisma.dailyProductionBalanceHistory.findMany({
    where: { balanceId: BigInt(balanceId) },
    include: {
      changer: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return entries.map((entry) => ({
    id: Number(entry.id),
    balanceId: Number(entry.balanceId),
    snapshot: entry.snapshot as unknown as ProductionBalanceRecord | null,
    changeReason: entry.changeReason,
    changedBy: entry.changedBy,
    changedByEmail: entry.changer?.email ?? null,
    createdAt: entry.createdAt.toISOString(),
  }));
}
