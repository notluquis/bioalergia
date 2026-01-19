import { db } from "@finanzas/db";

export async function listLoans() {
  return await db.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      schedules: true,
    },
  });
}

export async function getLoanById(id: number) {
  return await db.loan.findUnique({
    where: { id },
    include: {
      schedules: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });
}

// biome-ignore lint/suspicious/noExplicitAny: legacy payload
export async function createLoan(data: any) {
  return await db.loan.create({
    data,
    include: {
      schedules: true,
    },
  });
}

// biome-ignore lint/suspicious/noExplicitAny: legacy payload
export async function updateLoan(id: number, data: any) {
  return await db.loan.update({
    where: { id },
    data,
    include: {
      schedules: true,
    },
  });
}

export async function deleteLoan(id: number) {
  return await db.loan.delete({
    where: { id },
  });
}

// biome-ignore lint/suspicious/noExplicitAny: legacy payload
export async function createLoanSchedule(data: any) {
  return await db.loanSchedule.create({
    data,
  });
}

// biome-ignore lint/suspicious/noExplicitAny: legacy payload
export async function updateLoanSchedule(id: number, data: any) {
  return await db.loanSchedule.update({
    where: { id },
    data,
  });
}

export async function deleteLoanSchedule(id: number) {
  return await db.loanSchedule.delete({
    where: { id },
  });
}
