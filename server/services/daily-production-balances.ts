import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";
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
  consultasMonto: number;
  controlesMonto: number;
  testsMonto: number;
  vacunasMonto: number;
  licenciasMonto: number;
  roxairMonto: number;
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
  consultasMonto: number;
  controlesMonto: number;
  testsMonto: number;
  vacunasMonto: number;
  licenciasMonto: number;
  roxairMonto: number;
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

// Define the Prisma payload type with relations included
type BalanceWithRelations = Prisma.DailyProductionBalanceGetPayload<{
  include: {
    user: { select: { email: true } };
  };
}>;

function mapBalanceRecord(balance: BalanceWithRelations): ProductionBalanceRecord {
  const subtotalIngresos = balance.ingresoTarjetas + balance.ingresoTransferencias + balance.ingresoEfectivo;
  const totalIngresos = subtotalIngresos - balance.gastosDiarios;
  const total = totalIngresos + balance.otrosAbonos;

  return {
    id: Number(balance.id),
    balanceDate: dayjs(balance.balanceDate).format("YYYY-MM-DD"),
    ingresoTarjetas: balance.ingresoTarjetas,
    ingresoTransferencias: balance.ingresoTransferencias,
    ingresoEfectivo: balance.ingresoEfectivo,
    subtotalIngresos,
    gastosDiarios: balance.gastosDiarios,
    totalIngresos,
    consultasMonto: balance.consultasMonto,
    controlesMonto: balance.controlesMonto,
    testsMonto: balance.testsMonto,
    vacunasMonto: balance.vacunasMonto,
    licenciasMonto: balance.licenciasMonto,
    roxairMonto: balance.roxairMonto,
    otrosAbonos: balance.otrosAbonos,
    total,
    comentarios: balance.comentarios,
    status: balance.status as ProductionBalanceStatus,
    createdBy: balance.createdBy,
    updatedBy: null, // Not tracked in new schema
    createdByEmail: balance.user?.email ?? null,
    updatedByEmail: null, // Not tracked in new schema
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
      user: { select: { email: true } },
    },
    orderBy: [{ balanceDate: "desc" }, { id: "desc" }],
    take: 500,
  });

  return balances.map(mapBalanceRecord);
}

export async function getProductionBalanceById(id: number): Promise<ProductionBalanceRecord | null> {
  const balance = await prisma.dailyProductionBalance.findUnique({
    where: { id },
    include: {
      user: { select: { email: true } },
    },
  });

  return balance ? mapBalanceRecord(balance) : null;
}

export async function createProductionBalance(
  payload: ProductionBalancePayload,
  userId: number
): Promise<ProductionBalanceRecord> {
  const balance = await prisma.dailyProductionBalance.create({
    data: {
      balanceDate: new Date(payload.balanceDate),
      ingresoTarjetas: asInt(payload.ingresoTarjetas),
      ingresoTransferencias: asInt(payload.ingresoTransferencias),
      ingresoEfectivo: asInt(payload.ingresoEfectivo),
      gastosDiarios: asInt(payload.gastosDiarios),
      consultasMonto: asInt(payload.consultasMonto),
      controlesMonto: asInt(payload.controlesMonto),
      testsMonto: asInt(payload.testsMonto),
      vacunasMonto: asInt(payload.vacunasMonto),
      licenciasMonto: asInt(payload.licenciasMonto),
      roxairMonto: asInt(payload.roxairMonto),
      otrosAbonos: asInt(payload.otrosAbonos),
      comentarios: payload.comentarios,
      status: payload.status,
      changeReason: payload.changeReason,
      createdBy: userId,
    },
    include: {
      user: { select: { email: true } },
    },
  });

  return mapBalanceRecord(balance);
}

export async function updateProductionBalance(
  id: number,
  payload: ProductionBalancePayload
): Promise<ProductionBalanceRecord> {
  const existing = await getProductionBalanceById(id);
  if (!existing) {
    throw new Error("Balance no encontrado");
  }

  // Note: History tracking removed as table is missing in new schema.
  // Also updatedBy is removed.

  const balance = await prisma.dailyProductionBalance.update({
    where: { id },
    data: {
      balanceDate: new Date(payload.balanceDate),
      ingresoTarjetas: asInt(payload.ingresoTarjetas),
      ingresoTransferencias: asInt(payload.ingresoTransferencias),
      ingresoEfectivo: asInt(payload.ingresoEfectivo),
      gastosDiarios: asInt(payload.gastosDiarios),
      consultasMonto: asInt(payload.consultasMonto),
      controlesMonto: asInt(payload.controlesMonto),
      testsMonto: asInt(payload.testsMonto),
      vacunasMonto: asInt(payload.vacunasMonto),
      licenciasMonto: asInt(payload.licenciasMonto),
      roxairMonto: asInt(payload.roxairMonto),
      otrosAbonos: asInt(payload.otrosAbonos),
      comentarios: payload.comentarios,
      status: payload.status,
      changeReason: payload.changeReason,
      // updatedBy: userId, // Removed
    },
    include: {
      user: { select: { email: true } },
    },
  });

  return mapBalanceRecord(balance);
}

export async function hasBalanceForDate(date: Date | string): Promise<boolean> {
  const d = new Date(date);
  const count = await prisma.dailyProductionBalance.count({
    where: {
      balanceDate: d,
    },
  });
  return count > 0;
}
