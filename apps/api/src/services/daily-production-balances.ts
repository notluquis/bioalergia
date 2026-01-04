import { db } from "@finanzas/db";
import dayjs from "dayjs";

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

export async function createProductionBalance(data: any, userId: number) {
  return await db.dailyProductionBalance.create({
    data: {
      ...data,
      createdBy: userId,
    },
    include: {
      user: { select: { email: true } },
    },
  });
}

export async function updateProductionBalance(id: number, data: any) {
  return await db.dailyProductionBalance.update({
    where: { id },
    data,
    include: {
      user: { select: { email: true } },
    },
  });
}
