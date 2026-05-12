import { db } from "@finanzas/db";
import dayjs from "dayjs";
import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import { AppError } from "../lib/app-error.ts";
import "../lib/time.ts";

type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";
type LoanBorrowerType = "COMPANY" | "PERSON";
type LoanFrequency = "BIWEEKLY" | "MONTHLY" | "WEEKLY";
type LoanInterestType = "COMPOUND" | "SIMPLE";
type LoanScheduleStatus = "OVERDUE" | "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";

type LoanPayload = {
  borrowerName: string;
  borrowerType: LoanBorrowerType;
  frequency: LoanFrequency;
  generateSchedule?: boolean;
  interestRate: number;
  interestType: LoanInterestType;
  notes?: null | string;
  principalAmount: number;
  startDate: string;
  status?: LoanStatus;
  title: string;
  totalInstallments: number;
};

type LoanUpdatePayload = Partial<Omit<LoanPayload, "generateSchedule">>;

type LoanPaymentPayload = {
  paidAmount: number;
  paidDate: string;
  transactionId: number;
};

type RegenerateLoanSchedulesPayload = {
  frequency?: LoanFrequency;
  interestRate?: number;
  startDate?: string;
  totalInstallments?: number;
};

const MONEY_ROUNDING = Decimal.ROUND_HALF_UP;
const PERIODS_PER_YEAR: Record<LoanFrequency, number> = {
  BIWEEKLY: 26,
  MONTHLY: 12,
  WEEKLY: 52,
};

const toDateOnly = (value: string) => dayjs.utc(value, "YYYY-MM-DD").startOf("day").toDate();
const formatDateOnly = (value: Date) => dayjs.utc(value).format("YYYY-MM-DD");
const toDecimal = (value: Decimal.Value) => new Decimal(value);
const toMoney = (value: Decimal.Value) => toDecimal(value).toDecimalPlaces(2, MONEY_ROUNDING);
const optionalNote = (value?: null | string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const createPublicId = () => `loan_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

const getDueDateForInstallment = (
  startDate: Date,
  frequency: LoanFrequency,
  installmentNumber: number
) => {
  const date = dayjs.utc(startDate);
  if (frequency === "MONTHLY") {
    return date.add(installmentNumber, "month").startOf("day").toDate();
  }

  const weeks = frequency === "BIWEEKLY" ? installmentNumber * 2 : installmentNumber;
  return date.add(weeks, "week").startOf("day").toDate();
};

const mapScheduleStatus = (schedule: {
  dueDate: Date;
  paidAmount: Decimal | null;
  status: LoanScheduleStatus;
}) => {
  if (
    schedule.status === "PAID" ||
    schedule.status === "PARTIAL" ||
    schedule.status === "SKIPPED"
  ) {
    return schedule.status;
  }

  if (dayjs(schedule.dueDate).isBefore(dayjs(), "day")) {
    return "OVERDUE" as const;
  }

  return "PENDING" as const;
};

const mapTransaction = (
  transaction:
    | {
        amount: Decimal;
        date: Date;
        description: string;
        id: number;
      }
    | null
    | undefined
) => {
  if (!transaction) {
    return null;
  }

  return {
    amount: transaction.amount ? Number(transaction.amount) : null,
    description: transaction.description ?? null,
    id: transaction.id,
    timestamp: transaction.date,
  };
};

const mapSchedule = (schedule: {
  createdAt: Date;
  dueDate: Date;
  expectedAmount: Decimal;
  expectedInterest: Decimal;
  expectedPrincipal: Decimal;
  id: number;
  installmentNumber: number;
  loanId: number;
  paidAmount: Decimal | null;
  paidDate: Date | null;
  status: LoanScheduleStatus;
  transaction?: {
    amount: Decimal;
    date: Date;
    description: string;
    id: number;
  } | null;
  transactionId: number | null;
  updatedAt: Date;
}) => {
  const effectiveStatus = mapScheduleStatus(schedule);

  return {
    created_at: schedule.createdAt,
    due_date: formatDateOnly(schedule.dueDate),
    expected_amount: Number(schedule.expectedAmount),
    expected_interest: Number(schedule.expectedInterest),
    expected_principal: Number(schedule.expectedPrincipal),
    id: schedule.id,
    installment_number: schedule.installmentNumber,
    loan_id: schedule.loanId,
    paid_amount: schedule.paidAmount ? Number(schedule.paidAmount) : null,
    paid_date: schedule.paidDate ? formatDateOnly(schedule.paidDate) : null,
    status: effectiveStatus,
    transaction: mapTransaction(schedule.transaction),
    transaction_id: schedule.transactionId,
    updated_at: schedule.updatedAt,
  };
};

const computeSummary = (
  schedules: Array<{
    dueDate: Date;
    expectedAmount: Decimal;
    paidAmount: Decimal | null;
    status: LoanScheduleStatus;
  }>
) => {
  const totalExpected = schedules.reduce(
    (sum, schedule) => sum.plus(schedule.expectedAmount),
    new Decimal(0)
  );
  const totalPaid = schedules.reduce(
    (sum, schedule) => sum.plus(schedule.paidAmount ?? 0),
    new Decimal(0)
  );
  const paidInstallments = schedules.filter(
    (schedule) => mapScheduleStatus(schedule) === "PAID"
  ).length;
  const pendingInstallments = schedules.filter((schedule) => {
    const status = mapScheduleStatus(schedule);
    return status !== "PAID" && status !== "SKIPPED";
  }).length;
  const remainingAmount = Decimal.max(totalExpected.minus(totalPaid), 0);

  return {
    paid_installments: paidInstallments,
    pending_installments: pendingInstallments,
    remaining_amount: Number(remainingAmount),
    total_expected: Number(totalExpected),
    total_paid: Number(totalPaid),
  };
};

const mapLoanSummary = (loan: {
  borrowerName: string;
  borrowerType: LoanBorrowerType;
  createdAt: Date;
  frequency: LoanFrequency;
  id: number;
  interestRate: Decimal;
  interestType: LoanInterestType;
  notes: string | null;
  principalAmount: Decimal;
  publicId: string;
  schedules: Array<{
    dueDate: Date;
    expectedAmount: Decimal;
    paidAmount: Decimal | null;
    status: LoanScheduleStatus;
  }>;
  startDate: Date;
  status: LoanStatus;
  title: string;
  totalInstallments: number;
  updatedAt: Date;
}) => {
  const summary = computeSummary(loan.schedules);

  return {
    borrower_name: loan.borrowerName,
    borrower_type: loan.borrowerType,
    created_at: loan.createdAt,
    frequency: loan.frequency,
    id: loan.id,
    interest_rate: Number(loan.interestRate),
    interest_type: loan.interestType,
    notes: loan.notes,
    paid_installments: summary.paid_installments,
    pending_installments: summary.pending_installments,
    principal_amount: Number(loan.principalAmount),
    public_id: loan.publicId,
    remaining_amount: summary.remaining_amount,
    start_date: formatDateOnly(loan.startDate),
    status: loan.status,
    title: loan.title,
    total_expected: summary.total_expected,
    total_installments: loan.totalInstallments,
    total_paid: summary.total_paid,
    updated_at: loan.updatedAt,
  };
};

const generateSchedules = (loan: {
  frequency: LoanFrequency;
  id: number;
  interestRate: Decimal;
  interestType: LoanInterestType;
  principalAmount: Decimal;
  startDate: Date;
  totalInstallments: number;
}) => {
  const principal = toMoney(loan.principalAmount);
  const scheduleCount = loan.totalInstallments;
  const perPeriodRate = toDecimal(loan.interestRate).div(100).div(PERIODS_PER_YEAR[loan.frequency]);

  const schedules: Array<{
    dueDate: Date;
    expectedAmount: Decimal;
    expectedInterest: Decimal;
    expectedPrincipal: Decimal;
    installmentNumber: number;
    loanId: number;
    status: "PENDING";
  }> = [];

  if (scheduleCount <= 0) {
    return schedules;
  }

  if (loan.interestType === "COMPOUND" && !perPeriodRate.isZero()) {
    let balance = principal;
    const rate = perPeriodRate;
    const payment = principal
      .mul(rate)
      .div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-scheduleCount)));

    for (let installment = 1; installment <= scheduleCount; installment += 1) {
      const interest = toMoney(balance.mul(rate));
      let principalPart =
        installment === scheduleCount ? balance : toMoney(toDecimal(payment).minus(interest));
      if (principalPart.isNegative()) {
        principalPart = new Decimal(0);
      }
      const amount =
        installment === scheduleCount ? toMoney(principalPart.plus(interest)) : toMoney(payment);

      schedules.push({
        dueDate: getDueDateForInstallment(loan.startDate, loan.frequency, installment),
        expectedAmount: amount,
        expectedInterest: interest,
        expectedPrincipal: principalPart,
        installmentNumber: installment,
        loanId: loan.id,
        status: "PENDING",
      });

      balance = Decimal.max(balance.minus(principalPart), 0);
    }

    return schedules;
  }

  const totalInterest = toMoney(principal.mul(perPeriodRate).mul(scheduleCount));
  let remainingPrincipal = principal;
  let remainingInterest = totalInterest;
  const basePrincipal = toMoney(principal.div(scheduleCount));
  const baseInterest =
    scheduleCount > 0 ? toMoney(totalInterest.div(scheduleCount)) : new Decimal(0);

  for (let installment = 1; installment <= scheduleCount; installment += 1) {
    const principalPart = installment === scheduleCount ? remainingPrincipal : basePrincipal;
    const interestPart = installment === scheduleCount ? remainingInterest : baseInterest;
    const amount = toMoney(principalPart.plus(interestPart));

    schedules.push({
      dueDate: getDueDateForInstallment(loan.startDate, loan.frequency, installment),
      expectedAmount: amount,
      expectedInterest: interestPart,
      expectedPrincipal: principalPart,
      installmentNumber: installment,
      loanId: loan.id,
      status: "PENDING",
    });

    remainingPrincipal = Decimal.max(remainingPrincipal.minus(principalPart), 0);
    remainingInterest = Decimal.max(remainingInterest.minus(interestPart), 0);
  }

  return schedules;
};

const getLoanWithSchedules = async (publicId: string) => {
  return await db.loan.findUnique({
    where: { publicId },
    include: {
      schedules: {
        include: {
          transaction: {
            select: {
              amount: true,
              date: true,
              description: true,
              id: true,
            },
          },
        },
        orderBy: { installmentNumber: "asc" },
      },
    },
  });
};

const syncLoanStatus = async (loanId: number) => {
  const schedules = await db.loanSchedule.findMany({
    where: { loanId },
    select: {
      dueDate: true,
      paidAmount: true,
      status: true,
    },
  });

  const isCompleted =
    schedules.length > 0 &&
    schedules.every((schedule) => {
      const status = mapScheduleStatus(schedule);
      return status === "PAID" || status === "SKIPPED";
    });

  await db.loan.update({
    where: { id: loanId },
    data: {
      status: isCompleted ? "COMPLETED" : "ACTIVE",
    },
  });
};

const ensureLoanExists = async (publicId: string) => {
  const loan = await getLoanWithSchedules(publicId);
  if (!loan) {
    throw new AppError(404, {
      code: "LOAN_NOT_FOUND",
      message: "Préstamo no encontrado",
    });
  }
  return loan;
};

const ensureScheduleExists = async (scheduleId: number) => {
  const schedule = await db.loanSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      loan: true,
    },
  });

  if (!schedule) {
    throw new AppError(404, {
      code: "LOAN_SCHEDULE_NOT_FOUND",
      message: "Cuota no encontrada",
    });
  }

  return schedule;
};

export async function listLoans() {
  const loans = await db.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      schedules: {
        select: {
          dueDate: true,
          expectedAmount: true,
          paidAmount: true,
          status: true,
        },
      },
    },
  });

  return loans.map(mapLoanSummary);
}

export async function getLoanDetail(publicId: string) {
  const loan = await ensureLoanExists(publicId);

  return {
    loan: mapLoanSummary(loan),
    schedules: loan.schedules.map(mapSchedule),
    summary: computeSummary(loan.schedules),
  };
}

export async function createLoan(data: LoanPayload) {
  const loan = await db.loan.create({
    data: {
      borrowerName: data.borrowerName.trim(),
      borrowerType: data.borrowerType,
      frequency: data.frequency,
      interestRate: toDecimal(data.interestRate),
      interestType: data.interestType,
      notes: optionalNote(data.notes),
      principalAmount: toMoney(data.principalAmount),
      publicId: createPublicId(),
      startDate: toDateOnly(data.startDate),
      status: data.status ?? "ACTIVE",
      title: data.title.trim(),
      totalInstallments: data.totalInstallments,
    },
  });

  if (data.generateSchedule ?? true) {
    const schedules = generateSchedules(loan);
    if (schedules.length > 0) {
      await db.loanSchedule.createMany({ data: schedules });
    }
  }

  return await getLoanDetail(loan.publicId);
}

export async function updateLoan(publicId: string, data: LoanUpdatePayload) {
  const loan = await ensureLoanExists(publicId);

  await db.loan.update({
    where: { id: loan.id },
    data: {
      ...(data.title === undefined ? {} : { title: data.title.trim() }),
      ...(data.borrowerName === undefined ? {} : { borrowerName: data.borrowerName.trim() }),
      ...(data.borrowerType === undefined ? {} : { borrowerType: data.borrowerType }),
      ...(data.frequency === undefined ? {} : { frequency: data.frequency }),
      ...(data.interestRate === undefined ? {} : { interestRate: toDecimal(data.interestRate) }),
      ...(data.interestType === undefined ? {} : { interestType: data.interestType }),
      ...(data.notes === undefined ? {} : { notes: optionalNote(data.notes) }),
      ...(data.principalAmount === undefined
        ? {}
        : { principalAmount: toMoney(data.principalAmount) }),
      ...(data.startDate === undefined ? {} : { startDate: toDateOnly(data.startDate) }),
      ...(data.status === undefined ? {} : { status: data.status }),
      ...(data.totalInstallments === undefined
        ? {}
        : { totalInstallments: data.totalInstallments }),
    },
  });

  return await getLoanDetail(publicId);
}

export async function deleteLoan(publicId: string) {
  const loan = await ensureLoanExists(publicId);
  await db.loan.delete({ where: { id: loan.id } });
}

export async function regenerateLoanSchedules(
  publicId: string,
  overrides: RegenerateLoanSchedulesPayload
) {
  const loan = await ensureLoanExists(publicId);

  const hasRegisteredPayments = loan.schedules.some(
    (schedule) => schedule.paidAmount !== null || schedule.transactionId !== null
  );
  if (hasRegisteredPayments) {
    throw new AppError(409, {
      code: "LOAN_SCHEDULES_LOCKED",
      message: "No se puede regenerar un préstamo que ya tiene pagos registrados",
    });
  }

  await db.loan.update({
    where: { id: loan.id },
    data: {
      ...(overrides.frequency === undefined ? {} : { frequency: overrides.frequency }),
      ...(overrides.interestRate === undefined
        ? {}
        : { interestRate: toDecimal(overrides.interestRate) }),
      ...(overrides.startDate === undefined ? {} : { startDate: toDateOnly(overrides.startDate) }),
      ...(overrides.totalInstallments === undefined
        ? {}
        : { totalInstallments: overrides.totalInstallments }),
    },
  });

  const refreshedLoan = await db.loan.findUniqueOrThrow({
    where: { id: loan.id },
  });

  await db.loanSchedule.deleteMany({ where: { loanId: loan.id } });
  const schedules = generateSchedules(refreshedLoan);
  if (schedules.length > 0) {
    await db.loanSchedule.createMany({ data: schedules });
  }

  return await getLoanDetail(publicId);
}

export async function registerLoanPayment(scheduleId: number, data: LoanPaymentPayload) {
  const schedule = await ensureScheduleExists(scheduleId);

  const transaction = await db.financialTransaction.findUnique({
    where: { id: data.transactionId },
    select: { id: true },
  });

  if (!transaction) {
    throw new AppError(404, {
      code: "TRANSACTION_NOT_FOUND",
      message: "Transacción no encontrada",
    });
  }

  const paidAmount = toMoney(data.paidAmount);
  const expectedAmount = toMoney(schedule.expectedAmount);
  const nextStatus: LoanScheduleStatus = paidAmount.greaterThanOrEqualTo(expectedAmount)
    ? "PAID"
    : "PARTIAL";

  const updated = await db.loanSchedule.update({
    where: { id: scheduleId },
    data: {
      paidAmount,
      paidDate: toDateOnly(data.paidDate),
      status: nextStatus,
      transactionId: data.transactionId,
    },
    include: {
      transaction: {
        select: {
          amount: true,
          date: true,
          description: true,
          id: true,
        },
      },
    },
  });

  await syncLoanStatus(schedule.loanId);

  return mapSchedule(updated);
}

export async function unlinkLoanPayment(scheduleId: number) {
  const schedule = await ensureScheduleExists(scheduleId);
  const nextStatus: LoanScheduleStatus = dayjs(schedule.dueDate).isBefore(dayjs(), "day")
    ? "OVERDUE"
    : "PENDING";

  const updated = await db.loanSchedule.update({
    where: { id: scheduleId },
    data: {
      note: null,
      paidAmount: null,
      paidDate: null,
      status: nextStatus,
      transactionId: null,
    },
    include: {
      transaction: {
        select: {
          amount: true,
          date: true,
          description: true,
          id: true,
        },
      },
    },
  });

  await syncLoanStatus(schedule.loanId);

  return mapSchedule(updated);
}
