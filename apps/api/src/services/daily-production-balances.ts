import { db } from "@finanzas/db";
import dayjs from "dayjs";

export type ProductionBalancePayload = {
  balanceDate: string;
  ingresoTarjetas: number;
  ingresoTransferencias: number;
  ingresoEfectivo: number;
  gastosDiarios: number;
  otrosAbonos: number;
  comentarios?: string | null;
  status?: string;
  changeReason?: string | null;
  consultasMonto: number;
  controlesMonto: number;
  testsMonto: number;
  vacunasMonto: number;
  licenciasMonto: number;
  roxairMonto: number;
};

export type ProductionBalanceUpdatePayload = Partial<ProductionBalancePayload>;

const toDateOnly = (value: string) => dayjs(value).startOf("day").toDate();

export async function listProductionBalances(from: string, to: string) {
  const fromDate = dayjs(from).startOf("day").toDate();
  const toDate = dayjs(to).endOf("day").toDate();

  return await db.dailyProductionBalance.findMany({
    where: {
      balanceDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    include: {
      user: { select: { email: true } },
    },
    orderBy: [{ balanceDate: "desc" }, { id: "desc" }],
  });
}

export async function getProductionBalanceById(id: number) {
  return await db.dailyProductionBalance.findUnique({
    where: { id },
    include: {
      user: { select: { email: true } },
    },
  });
}

export async function createProductionBalance(data: ProductionBalancePayload, userId: number) {
  return await db.dailyProductionBalance.create({
    data: {
      balanceDate: toDateOnly(data.balanceDate),
      ingresoTarjetas: data.ingresoTarjetas,
      ingresoTransferencias: data.ingresoTransferencias,
      ingresoEfectivo: data.ingresoEfectivo,
      gastosDiarios: data.gastosDiarios,
      otrosAbonos: data.otrosAbonos,
      comentarios: data.comentarios ?? null,
      status: data.status ?? "DRAFT",
      changeReason: data.changeReason ?? null,
      createdBy: userId,
      consultasMonto: data.consultasMonto,
      controlesMonto: data.controlesMonto,
      testsMonto: data.testsMonto,
      vacunasMonto: data.vacunasMonto,
      licenciasMonto: data.licenciasMonto,
      roxairMonto: data.roxairMonto,
    },
    include: {
      user: { select: { email: true } },
    },
  });
}

export async function updateProductionBalance(id: number, data: ProductionBalanceUpdatePayload) {
  const updateData: Record<string, unknown> = {};
  if (data.balanceDate !== undefined) {
    updateData.balanceDate = toDateOnly(data.balanceDate);
  }
  if (data.ingresoTarjetas !== undefined) {
    updateData.ingresoTarjetas = data.ingresoTarjetas;
  }
  if (data.ingresoTransferencias !== undefined) {
    updateData.ingresoTransferencias = data.ingresoTransferencias;
  }
  if (data.ingresoEfectivo !== undefined) {
    updateData.ingresoEfectivo = data.ingresoEfectivo;
  }
  if (data.gastosDiarios !== undefined) {
    updateData.gastosDiarios = data.gastosDiarios;
  }
  if (data.otrosAbonos !== undefined) {
    updateData.otrosAbonos = data.otrosAbonos;
  }
  if (data.comentarios !== undefined) {
    updateData.comentarios = data.comentarios;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  if (data.changeReason !== undefined) {
    updateData.changeReason = data.changeReason;
  }
  if (data.consultasMonto !== undefined) {
    updateData.consultasMonto = data.consultasMonto;
  }
  if (data.controlesMonto !== undefined) {
    updateData.controlesMonto = data.controlesMonto;
  }
  if (data.testsMonto !== undefined) {
    updateData.testsMonto = data.testsMonto;
  }
  if (data.vacunasMonto !== undefined) {
    updateData.vacunasMonto = data.vacunasMonto;
  }
  if (data.licenciasMonto !== undefined) {
    updateData.licenciasMonto = data.licenciasMonto;
  }
  if (data.roxairMonto !== undefined) {
    updateData.roxairMonto = data.roxairMonto;
  }
  return await db.dailyProductionBalance.update({
    where: { id },
    data: updateData,
    include: {
      user: { select: { email: true } },
    },
  });
}
