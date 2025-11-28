import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

export async function listLoans() {
  return await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      schedules: true,
    },
  });
}

export async function getLoanById(id: number) {
  return await prisma.loan.findUnique({
    where: { id },
    include: {
      schedules: {
        orderBy: { installmentNumber: "asc" },
      },
    },
  });
}

export async function createLoan(data: Prisma.LoanUncheckedCreateInput) {
  return await prisma.loan.create({
    data,
    include: {
      schedules: true,
    },
  });
}

export async function updateLoan(id: number, data: Prisma.LoanUncheckedUpdateInput) {
  return await prisma.loan.update({
    where: { id },
    data,
    include: {
      schedules: true,
    },
  });
}

export async function deleteLoan(id: number) {
  return await prisma.loan.delete({
    where: { id },
  });
}

export async function createLoanSchedule(data: Prisma.LoanScheduleUncheckedCreateInput) {
  return await prisma.loanSchedule.create({
    data,
  });
}

export async function updateLoanSchedule(id: number, data: Prisma.LoanScheduleUncheckedUpdateInput) {
  return await prisma.loanSchedule.update({
    where: { id },
    data,
  });
}

export async function deleteLoanSchedule(id: number) {
  return await prisma.loanSchedule.delete({
    where: { id },
  });
}
