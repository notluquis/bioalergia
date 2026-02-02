import type {
  LoanCreateArgs,
  LoanScheduleCreateArgs,
  LoanScheduleUpdateArgs,
  LoanUpdateArgs,
} from "@finanzas/db";
import { db } from "@finanzas/db";

// Extract input types from Zenstack args
type LoanCreateInput = NonNullable<LoanCreateArgs["data"]>;
type LoanUpdateInput = NonNullable<LoanUpdateArgs["data"]>;
type LoanScheduleCreateInput = NonNullable<LoanScheduleCreateArgs["data"]>;
type LoanScheduleUpdateInput = NonNullable<LoanScheduleUpdateArgs["data"]>;

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

export async function createLoan(data: LoanCreateInput) {
  return await db.loan.create({
    data,
    include: {
      schedules: true,
    },
  });
}

export async function updateLoan(id: number, data: LoanUpdateInput) {
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

export async function createLoanSchedule(data: LoanScheduleCreateInput) {
  return await db.loanSchedule.create({
    data,
  });
}

export async function updateLoanSchedule(id: number, data: LoanScheduleUpdateInput) {
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
