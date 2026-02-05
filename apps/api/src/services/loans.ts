import { db } from "@finanzas/db";
import dayjs from "dayjs";
import { Decimal } from "decimal.js";

type LoanPayload = {
  title: string;
  principalAmount: number;
  interestRate: number;
  startDate: string;
  status?: "ACTIVE" | "COMPLETED" | "DEFAULTED";
};

type LoanUpdatePayload = Partial<LoanPayload>;

type LoanSchedulePayload = {
  loanId: number;
  installmentNumber: number;
  dueDate: Date;
  expectedAmount: Decimal;
  status?: "PENDING" | "PAID" | "PARTIAL" | "OVERDUE";
};

const toDateOnly = (value: string) => dayjs(value).startOf("day").toDate();
const toDecimal = (value: number) => new Decimal(value);

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

export async function createLoan(data: LoanPayload) {
  return await db.loan.create({
    data: {
      title: data.title,
      principalAmount: toDecimal(data.principalAmount),
      interestRate: toDecimal(data.interestRate),
      startDate: toDateOnly(data.startDate),
      status: data.status ?? "ACTIVE",
    },
    include: {
      schedules: true,
    },
  });
}

export async function updateLoan(id: number, data: LoanUpdatePayload) {
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.principalAmount !== undefined) {
    updateData.principalAmount = toDecimal(data.principalAmount);
  }
  if (data.interestRate !== undefined) {
    updateData.interestRate = toDecimal(data.interestRate);
  }
  if (data.startDate !== undefined) {
    updateData.startDate = toDateOnly(data.startDate);
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  return await db.loan.update({
    where: { id },
    data: updateData,
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

export async function createLoanSchedule(data: LoanSchedulePayload) {
  return await db.loanSchedule.create({
    data,
  });
}

export async function updateLoanSchedule(id: number, data: Partial<LoanSchedulePayload>) {
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
