import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import dayjs from "dayjs";
import { roundCurrency } from "../../shared/currency.js";

type LoanFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

type LoanScheduleItem = {
  installment_number: number;
  due_date: Date;
  expected_amount: number;
  expected_principal: number;
  expected_interest: number;
};

function computeLoanSchedule(
  loan: Prisma.LoanGetPayload<{}>,
  overrides?: { totalInstallments?: number; startDate?: string; interestRate?: number; frequency?: LoanFrequency }
): LoanScheduleItem[] {
  const totalInstallments = overrides?.totalInstallments ?? loan.totalInstallments;
  const frequency = (overrides?.frequency ?? loan.frequency) as LoanFrequency;
  const startDate = overrides?.startDate ? dayjs(overrides.startDate) : dayjs(loan.startDate);
  const interestRate = overrides?.interestRate ?? Number(loan.interestRate);

  const principal = Number(loan.principalAmount);
  const rateDecimal = interestRate / 100;
  const simpleInterestTotal = principal * rateDecimal;
  const totalAmount = principal + simpleInterestTotal;
  const basePrincipal = principal / totalInstallments;
  const baseInterest = simpleInterestTotal / totalInstallments;

  let remainingPrincipal = principal;
  let interestAccum = 0;
  let amountAccum = 0;
  const schedule: LoanScheduleItem[] = [];
  const baseDate = dayjs(startDate);

  for (let i = 0; i < totalInstallments; i += 1) {
    const installmentNumber = i + 1;
    const isLast = installmentNumber === totalInstallments;

    let principalShare = roundCurrency(isLast ? remainingPrincipal : basePrincipal);
    remainingPrincipal = roundCurrency(remainingPrincipal - principalShare);

    let interestShare = roundCurrency(isLast ? simpleInterestTotal - interestAccum : baseInterest);
    interestAccum = roundCurrency(interestAccum + interestShare);

    let amountShare = roundCurrency(principalShare + interestShare);
    if (isLast) {
      const expectedTotal = roundCurrency(totalAmount);
      amountShare = roundCurrency(expectedTotal - amountAccum);
    }
    amountAccum = roundCurrency(amountAccum + amountShare);

    let dueDate = baseDate;
    if (frequency === "WEEKLY") {
      dueDate = baseDate.add(i, "week");
    } else if (frequency === "BIWEEKLY") {
      dueDate = baseDate.add(i * 2, "week");
    } else {
      dueDate = baseDate.add(i, "month");
    }

    schedule.push({
      installment_number: installmentNumber,
      due_date: dueDate.toDate(),
      expected_amount: amountShare,
      expected_principal: principalShare,
      expected_interest: interestShare,
    });
  }

  return schedule;
}

export async function listLoansWithSummary() {
  const loans = await prisma.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      schedules: true,
    },
  });

  return loans.map((loan: Prisma.LoanGetPayload<{ include: { schedules: true } }>) => {
    const summary = loan.schedules.reduce(
      (
        acc: {
          total_expected: number;
          total_paid: number;
          remaining_amount: number;
          paid_installments: number;
          pending_installments: number;
        },
        s: Prisma.LoanScheduleGetPayload<{}>
      ) => {
        acc.total_expected += Number(s.expectedAmount);
        if (s.status === "PAID") {
          acc.total_paid += Number(s.paidAmount ?? s.expectedAmount);
          acc.paid_installments += 1;
        } else {
          acc.pending_installments += 1;
          acc.remaining_amount += Number(s.expectedAmount);
        }
        return acc;
      },
      {
        total_expected: 0,
        total_paid: 0,
        remaining_amount: 0,
        paid_installments: 0,
        pending_installments: 0,
      }
    );

    return {
      ...loan,
      summary,
    };
  });
}

export async function getLoanDetail(publicId: string) {
  const loan = await prisma.loan.findUnique({
    where: { publicId },
    include: {
      schedules: {
        orderBy: { installmentNumber: "asc" },
        include: {
          transaction: true,
        },
      },
    },
  });

  if (!loan) return null;

  // Update overdue status
  const today = dayjs().startOf("day");
  const overdueIds: number[] = [];

  loan.schedules.forEach((s: Prisma.LoanScheduleGetPayload<{ include: { transaction: true } }>) => {
    if (s.status === "PENDING" && s.dueDate && dayjs(s.dueDate).isBefore(today)) {
      overdueIds.push(s.id);
    }
  });

  if (overdueIds.length > 0) {
    await prisma.loanSchedule.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE" },
    });
    // Re-fetch schedules to get updated status
    const updatedSchedules = await prisma.loanSchedule.findMany({
      where: { loanId: loan.id },
      orderBy: { installmentNumber: "asc" },
      include: { transaction: true },
    });
    loan.schedules = updatedSchedules;
  }

  const summary = loan.schedules.reduce(
    (
      acc: {
        total_expected: number;
        total_paid: number;
        remaining_amount: number;
        paid_installments: number;
        pending_installments: number;
      },
      s: Prisma.LoanScheduleGetPayload<{}>
    ) => {
      acc.total_expected = roundCurrency(acc.total_expected + Number(s.expectedAmount));
      const paidAmount = s.status === "PAID" || s.status === "PARTIAL" ? Number(s.paidAmount ?? s.expectedAmount) : 0;
      acc.total_paid = roundCurrency(acc.total_paid + paidAmount);
      if (s.status === "PAID") {
        acc.paid_installments += 1;
      } else {
        acc.pending_installments += 1;
        acc.remaining_amount = roundCurrency(acc.remaining_amount + Number(s.expectedAmount));
      }
      return acc;
    },
    {
      total_expected: 0,
      total_paid: 0,
      remaining_amount: 0,
      paid_installments: 0,
      pending_installments: 0,
    }
  );

  return { loan, schedules: loan.schedules, summary };
}

export async function regenerateLoanSchedule(
  publicId: string,
  options?: { totalInstallments?: number; startDate?: string; interestRate?: number; frequency?: LoanFrequency }
) {
  const loan = await prisma.loan.findUnique({ where: { publicId } });
  if (!loan) throw new Error("Préstamo no encontrado");

  const schedule = computeLoanSchedule(loan, options);

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.loanSchedule.deleteMany({ where: { loanId: loan.id } });

    await tx.loanSchedule.createMany({
      data: schedule.map((s) => ({
        loanId: loan.id,
        installmentNumber: s.installment_number,
        dueDate: new Date(s.due_date),
        expectedAmount: s.expected_amount,
        expectedPrincipal: s.expected_principal,
        expectedInterest: s.expected_interest,
        status: "PENDING",
      })),
    });

    if (options) {
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          totalInstallments: options.totalInstallments ?? loan.totalInstallments,
          startDate: options.startDate ? new Date(options.startDate) : loan.startDate,
          interestRate: options.interestRate ?? loan.interestRate,
          frequency: options.frequency ?? loan.frequency,
        },
      });
    }
  });
}

export async function markLoanSchedulePayment(payload: {
  scheduleId: number;
  transactionId: number;
  paidAmount: number;
  paidDate: string;
}) {
  const schedule = await prisma.loanSchedule.findUnique({
    where: { id: payload.scheduleId },
    include: { loan: true },
  });
  if (!schedule) throw new Error("Cuota no encontrada");

  const paidAmount = roundCurrency(payload.paidAmount);
  const status = paidAmount >= Number(schedule.expectedAmount) ? "PAID" : "PARTIAL";

  return await prisma.loanSchedule.update({
    where: { id: payload.scheduleId },
    data: {
      transactionId: payload.transactionId,
      paidAmount,
      paidDate: new Date(payload.paidDate),
      status,
    },
    include: { transaction: true },
  });
}

export async function unlinkLoanSchedulePayment(scheduleId: number) {
  return await prisma.loanSchedule.update({
    where: { id: scheduleId },
    data: {
      transactionId: null,
      paidAmount: null,
      paidDate: null,
      status: "PENDING",
    },
    include: { transaction: true },
  });
}

export async function getLoanById(id: number) {
  return await prisma.loan.findUnique({
    where: { id },
    include: {
      schedules: {
        orderBy: { installmentNumber: "asc" },
        include: {
          transaction: true,
        },
      },
    },
  });
}

export async function getLoanByPublicId(publicId: string) {
  return await prisma.loan.findUnique({
    where: { publicId },
    include: {
      schedules: {
        orderBy: { installmentNumber: "asc" },
        include: {
          transaction: true,
        },
      },
    },
  });
}

export async function createLoan(data: Prisma.LoanCreateInput) {
  return await prisma.loan.create({
    data,
  });
}

export async function updateLoan(id: number, data: Prisma.LoanUpdateInput) {
  return await prisma.loan.update({
    where: { id },
    data,
  });
}

export async function updateLoanSchedule(id: number, data: Prisma.LoanScheduleUpdateInput) {
  return await prisma.loanSchedule.update({
    where: { id },
    data,
  });
}

export async function getLoanScheduleById(id: number) {
  return await prisma.loanSchedule.findUnique({
    where: { id },
    include: {
      loan: true,
      transaction: true,
    },
  });
}
