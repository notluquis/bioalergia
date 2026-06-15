import { db } from "@finanzas/db";
import { randomUUID } from "node:crypto";
import { Decimal } from "decimal.js";
import { DomainError } from "../lib/errors.ts";
import { dbDateToISO, isoToDbDate, toChileDateString } from "../lib/time.ts";

type LoanStatus = "ACTIVE" | "COMPLETED" | "DEFAULTED";
type LoanBorrowerType = "COMPANY" | "PERSON";
type LoanFrequency = "BIWEEKLY" | "IRREGULAR" | "MONTHLY" | "WEEKLY";
type LoanInterestType = "COMPOUND" | "SIMPLE";
type LoanSourceType = "BANK_CREDIT" | "CREDIT_CARD" | "OTHER" | "PERSON_LOAN" | "TRANSFER";
type LoanSchedulePaymentKind = "ADJUSTMENT" | "DISCOUNT" | "PAYMENT";
type LoanScheduleStatus = "OVERDUE" | "PAID" | "PARTIAL" | "PENDING" | "SKIPPED";
type ExpenseScope = "BIOALERGIA" | "PERSONAL";

type LoanPayload = {
  borrowerName: string;
  borrowerType: LoanBorrowerType;
  counterpartId?: null | number;
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

type StructuredLoanPayload = {
  borrowerName: string;
  borrowerType: LoanBorrowerType;
  counterpartId?: null | number;
  equalSchedule?: {
    firstDueDate: string;
    frequency: LoanFrequency;
    installments: number;
  };
  manualInstallments?: Array<{
    dueDate: string;
    expectedAmount: number;
    expectedInterest?: number;
    expectedPrincipal?: number;
    note?: null | string;
    payments?: StructuredLoanPaymentPayload[];
  }>;
  notes?: null | string;
  sources: Array<{
    disbursementDate?: string;
    feeAmount?: number;
    fixedInterestRate?: number;
    label: string;
    note?: null | string;
    principalAmount: number;
    sourceType?: LoanSourceType;
    totalAmount?: number;
  }>;
  startDate: string;
  status?: LoanStatus;
  title: string;
};

type StructuredLoanPaymentPayload = {
  amount: number;
  kind?: LoanSchedulePaymentKind;
  note?: null | string;
  paidDate: string;
  transactionId?: number;
};

type LoanPaymentPayload = {
  kind?: LoanSchedulePaymentKind;
  note?: null | string;
  paidAmount: number;
  paidDate: string;
  transactionId?: null | number;
};

type LoanPaymentCandidatesPayload = {
  daysAfter: number;
  daysBefore: number;
  limit: number;
};

type LoanScheduleUpdatePayload = {
  dueDate?: string;
  expectedAmount?: number;
  expectedInterest?: number;
  expectedPrincipal?: number;
  note?: null | string;
};

type LoanSchedulePaymentRow = {
  amount: Decimal;
  paidDate: Date;
  transactionId: null | number;
};

type LoanLinkedPaymentRow = {
  amount: Decimal;
  id: number;
  scheduleId: number;
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
  IRREGULAR: 12, // fallback: tratado como mensual para cálculo de tasa
  MONTHLY: 12,
  WEEKLY: 52,
};

const toDateOnly = (value: string) => isoToDbDate(value);
const formatDateOnly = (value: Date) => dbDateToISO(value) ?? "";
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
  // startDate is @db.Date (UTC-anchored calendar date); compute on PlainDate.
  const base = Temporal.PlainDate.from(dbDateToISO(startDate) ?? "");
  if (frequency === "MONTHLY") {
    return isoToDbDate(base.add({ months: installmentNumber }).toString());
  }

  const weeks = frequency === "BIWEEKLY" ? installmentNumber * 2 : installmentNumber;
  return isoToDbDate(base.add({ weeks }).toString());
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

  // dueDate is @db.Date; compare calendar days (UTC date vs today in Chile).
  if ((dbDateToISO(schedule.dueDate) ?? "") < toChileDateString(new Date())) {
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

const mapSource = (source: {
  disbursementDate: Date | null;
  feeAmount: Decimal;
  fixedInterestRate: Decimal;
  id: number;
  interestAmount: Decimal;
  label: string;
  note: null | string;
  principalAmount: Decimal;
  sourceType: LoanSourceType;
  totalAmount: Decimal;
}) => ({
  disbursement_date: source.disbursementDate ? formatDateOnly(source.disbursementDate) : null,
  fee_amount: Number(source.feeAmount),
  fixed_interest_rate: Number(source.fixedInterestRate),
  id: source.id,
  interest_amount: Number(source.interestAmount),
  label: source.label,
  note: source.note,
  principal_amount: Number(source.principalAmount),
  source_type: source.sourceType,
  total_amount: Number(source.totalAmount),
});

const mapSchedulePayment = (payment: {
  amount: Decimal;
  id: number;
  kind: LoanSchedulePaymentKind;
  note: null | string;
  paidDate: Date;
  transaction?: {
    amount: Decimal;
    date: Date;
    description: string;
    id: number;
  } | null;
  transactionId: number | null;
}) => ({
  amount: Number(payment.amount),
  id: payment.id,
  kind: payment.kind,
  note: payment.note,
  paid_date: formatDateOnly(payment.paidDate),
  transaction: mapTransaction(payment.transaction),
  transaction_id: payment.transactionId,
});

const mapSchedule = (schedule: {
  createdAt: Date;
  dueDate: Date;
  expectedAmount: Decimal;
  expectedInterest: Decimal;
  expectedPrincipal: Decimal;
  id: number;
  installmentNumber: number;
  loanId: number;
  note: null | string;
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
  payments?: Array<{
    amount: Decimal;
    id: number;
    kind: LoanSchedulePaymentKind;
    note: null | string;
    paidDate: Date;
    transaction?: {
      amount: Decimal;
      date: Date;
      description: string;
      id: number;
    } | null;
    transactionId: number | null;
  }>;
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
    note: schedule.note,
    paid_amount: schedule.paidAmount ? Number(schedule.paidAmount) : null,
    paid_date: schedule.paidDate ? formatDateOnly(schedule.paidDate) : null,
    payments: schedule.payments?.map(mapSchedulePayment) ?? [],
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

type LoanWithSchedules = {
  borrowerName: string;
  borrowerType: LoanBorrowerType;
  counterpart?: {
    bankAccountHolder: string;
    category: string;
    id: number;
    identificationNumber: string;
  } | null;
  counterpartId: null | number;
  createdAt: Date;
  frequency: LoanFrequency;
  id: number;
  interestRate: Decimal;
  interestType: LoanInterestType;
  notes: null | string;
  principalAmount: Decimal;
  publicId: string;
  schedules: Array<{
    dueDate: Date;
    expectedAmount: Decimal;
    paidAmount: Decimal | null;
    status: LoanScheduleStatus;
  }>;
  sources?: Array<{
    disbursementDate: Date | null;
    feeAmount: Decimal;
    fixedInterestRate: Decimal;
    id: number;
    interestAmount: Decimal;
    label: string;
    note: null | string;
    principalAmount: Decimal;
    sourceType: LoanSourceType;
    totalAmount: Decimal;
  }>;
  scope: ExpenseScope;
  startDate: Date;
  status: LoanStatus;
  title: string;
  totalInstallments: number;
  updatedAt: Date;
};

const mapLoanSummary = (loan: LoanWithSchedules) => {
  const summary = computeSummary(loan.schedules);

  return {
    borrower_name: loan.borrowerName,
    borrower_type: loan.borrowerType,
    counterpart: loan.counterpart
      ? {
          bankAccountHolder: loan.counterpart.bankAccountHolder,
          category: loan.counterpart.category,
          id: loan.counterpart.id,
          identificationNumber: loan.counterpart.identificationNumber,
        }
      : null,
    counterpart_id: loan.counterpartId,
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

type LoanForSchedule = {
  frequency: LoanFrequency;
  id: number;
  interestRate: Decimal;
  interestType: LoanInterestType;
  principalAmount: Decimal;
  startDate: Date;
  totalInstallments: number;
};

const generateSchedules = (loan: LoanForSchedule) => {
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

const getDueDateFromBase = (
  firstDueDate: Date,
  frequency: LoanFrequency,
  installmentNumber: number
) => {
  const base = Temporal.PlainDate.from(dbDateToISO(firstDueDate) ?? "");
  if (installmentNumber === 1) {
    return firstDueDate;
  }
  if (frequency === "MONTHLY") {
    return isoToDbDate(base.add({ months: installmentNumber - 1 }).toString());
  }

  const weeks = frequency === "BIWEEKLY" ? (installmentNumber - 1) * 2 : installmentNumber - 1;
  return isoToDbDate(base.add({ weeks }).toString());
};

const addDays = (date: Date, days: number) => {
  const plainDate = Temporal.PlainDate.from(dbDateToISO(date) ?? "");
  return isoToDbDate(plainDate.add({ days }).toString());
};

const buildStructuredSources = (sources: StructuredLoanPayload["sources"]) =>
  sources.map((source) => {
    const principal = toMoney(source.principalAmount);
    const rate = toDecimal(source.fixedInterestRate ?? 0);
    const fee = toMoney(source.feeAmount ?? 0);
    const interest = toMoney(principal.mul(rate).div(100));
    const total = toMoney(source.totalAmount ?? principal.plus(interest).plus(fee));

    return {
      disbursementDate: source.disbursementDate ? toDateOnly(source.disbursementDate) : null,
      feeAmount: fee,
      fixedInterestRate: rate,
      interestAmount: toMoney(total.minus(principal).minus(fee)),
      label: source.label.trim(),
      note: optionalNote(source.note),
      principalAmount: principal,
      sourceType: source.sourceType ?? "OTHER",
      totalAmount: total,
    };
  });

const buildEqualStructuredSchedules = (params: {
  firstDueDate: Date;
  frequency: LoanFrequency;
  installments: number;
  loanId: number;
  totalAmount: Decimal;
  totalInterest: Decimal;
  totalPrincipal: Decimal;
}) => {
  const baseAmount = toMoney(params.totalAmount.div(params.installments));
  const basePrincipal = toMoney(params.totalPrincipal.div(params.installments));
  const baseInterest = toMoney(params.totalInterest.div(params.installments));
  let remainingAmount = params.totalAmount;
  let remainingPrincipal = params.totalPrincipal;
  let remainingInterest = params.totalInterest;

  return Array.from({ length: params.installments }, (_, index) => {
    const installmentNumber = index + 1;
    const isLast = installmentNumber === params.installments;
    const expectedAmount = isLast ? remainingAmount : baseAmount;
    const expectedPrincipal = isLast ? remainingPrincipal : basePrincipal;
    const expectedInterest = isLast ? remainingInterest : baseInterest;

    remainingAmount = Decimal.max(remainingAmount.minus(expectedAmount), 0);
    remainingPrincipal = Decimal.max(remainingPrincipal.minus(expectedPrincipal), 0);
    remainingInterest = Decimal.max(remainingInterest.minus(expectedInterest), 0);

    return {
      dueDate: getDueDateFromBase(params.firstDueDate, params.frequency, installmentNumber),
      expectedAmount,
      expectedInterest,
      expectedPrincipal,
      installmentNumber,
      loanId: params.loanId,
      status: "PENDING" as const,
    };
  });
};

const summarizePayments = (payments: StructuredLoanPaymentPayload[] = []) => {
  const totalPaid = payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0));
  const paidDate = payments.reduce<Date | null>((latest, payment) => {
    const next = toDateOnly(payment.paidDate);
    return !latest || next > latest ? next : latest;
  }, null);

  return { paidDate, totalPaid: toMoney(totalPaid) };
};

const getLoanWithSchedules = async (publicId: string) => {
  return await db.loan.findUnique({
    where: { publicId },
    include: {
      counterpart: {
        select: {
          bankAccountHolder: true,
          category: true,
          id: true,
          identificationNumber: true,
        },
      },
      sources: {
        orderBy: { id: "asc" },
      },
      schedules: {
        include: {
          payments: {
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
            orderBy: { paidDate: "asc" },
          },
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
    throw new DomainError("NOT_FOUND", "Préstamo no encontrado");
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
    throw new DomainError("NOT_FOUND", "Cuota no encontrada");
  }

  return schedule;
};

const refreshSchedulePaymentSummary = async (scheduleId: number) => {
  const schedule = await db.loanSchedule.findUniqueOrThrow({
    where: { id: scheduleId },
    include: {
      payments: {
        orderBy: { paidDate: "asc" },
      },
    },
  });

  const payments = schedule.payments as LoanSchedulePaymentRow[];
  const hasSplitPayments = payments.length > 0;
  const totalPaid = hasSplitPayments
    ? payments.reduce((sum, payment) => sum.plus(payment.amount), new Decimal(0))
    : toMoney(schedule.paidAmount ?? 0);
  const paidDate = hasSplitPayments
    ? payments.reduce<Date | null>(
        (latest, payment) => (!latest || payment.paidDate > latest ? payment.paidDate : latest),
        null
      )
    : schedule.paidDate;
  const expectedAmount = toMoney(schedule.expectedAmount);
  const nextStatus: LoanScheduleStatus = totalPaid.isZero()
    ? (dbDateToISO(schedule.dueDate) ?? "") < toChileDateString(new Date())
      ? "OVERDUE"
      : "PENDING"
    : totalPaid.greaterThanOrEqualTo(expectedAmount)
      ? "PAID"
      : "PARTIAL";
  const primaryPayment = payments.find((payment) => payment.transactionId !== null);

  return await db.loanSchedule.update({
    where: { id: scheduleId },
    data: {
      paidAmount: totalPaid.isZero() ? null : toMoney(totalPaid),
      paidDate,
      status: nextStatus,
      transactionId: hasSplitPayments
        ? (primaryPayment?.transactionId ?? null)
        : (schedule.transactionId ?? null),
    },
    include: {
      payments: {
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
        orderBy: { paidDate: "asc" },
      },
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
};

export async function listLoans() {
  const loans = await db.loan.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      counterpart: {
        select: {
          bankAccountHolder: true,
          category: true,
          id: true,
          identificationNumber: true,
        },
      },
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
    sources: loan.sources?.map(mapSource) ?? [],
    summary: computeSummary(loan.schedules),
  };
}

export async function createLoan(data: LoanPayload) {
  const loan = await db.loan.create({
    data: {
      borrowerName: data.borrowerName.trim(),
      borrowerType: data.borrowerType,
      counterpartId: data.counterpartId ?? null,
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

export async function createStructuredLoan(data: StructuredLoanPayload) {
  if (!data.equalSchedule && !data.manualInstallments?.length) {
    throw new DomainError(
      "BAD_REQUEST",
      "Debes entregar cuotas manuales o una configuración de cuotas iguales"
    );
  }

  const sources = buildStructuredSources(data.sources);
  const totalAmount = sources.reduce((sum, source) => sum.plus(source.totalAmount), new Decimal(0));
  const totalPrincipal = sources.reduce(
    (sum, source) => sum.plus(source.principalAmount),
    new Decimal(0)
  );
  const totalInterest = sources.reduce(
    (sum, source) => sum.plus(source.interestAmount).plus(source.feeAmount),
    new Decimal(0)
  );
  const totalInstallments =
    data.manualInstallments?.length ?? data.equalSchedule?.installments ?? 1;
  const frequency = data.equalSchedule?.frequency ?? "IRREGULAR";

  const loan = await db.loan.create({
    data: {
      borrowerName: data.borrowerName.trim(),
      borrowerType: data.borrowerType,
      counterpartId: data.counterpartId ?? null,
      frequency,
      interestRate: new Decimal(0),
      interestType: "SIMPLE",
      notes: optionalNote(data.notes),
      principalAmount: toMoney(totalAmount),
      publicId: createPublicId(),
      startDate: toDateOnly(data.startDate),
      status: data.status ?? "ACTIVE",
      title: data.title.trim(),
      totalInstallments,
      sources: {
        create: sources,
      },
    },
  });

  if (data.manualInstallments?.length) {
    for (const [index, installment] of data.manualInstallments.entries()) {
      const payments = installment.payments ?? [];
      const expectedAmount = toMoney(installment.expectedAmount);
      const expectedPrincipal = toMoney(
        installment.expectedPrincipal ?? installment.expectedAmount
      );
      const expectedInterest = toMoney(installment.expectedInterest ?? 0);
      const { paidDate, totalPaid } = summarizePayments(payments);
      const status = totalPaid.isZero()
        ? "PENDING"
        : totalPaid.greaterThanOrEqualTo(expectedAmount)
          ? "PAID"
          : "PARTIAL";

      await db.loanSchedule.create({
        data: {
          dueDate: toDateOnly(installment.dueDate),
          expectedAmount,
          expectedInterest,
          expectedPrincipal,
          installmentNumber: index + 1,
          loanId: loan.id,
          note: optionalNote(installment.note),
          paidAmount: totalPaid.isZero() ? null : totalPaid,
          paidDate,
          status,
          payments: {
            create: payments.map((payment) => ({
              amount: toMoney(payment.amount),
              kind: payment.kind ?? "PAYMENT",
              note: optionalNote(payment.note),
              paidDate: toDateOnly(payment.paidDate),
              transactionId: payment.transactionId ?? null,
            })),
          },
        },
      });
    }
  } else if (data.equalSchedule) {
    await db.loanSchedule.createMany({
      data: buildEqualStructuredSchedules({
        firstDueDate: toDateOnly(data.equalSchedule.firstDueDate),
        frequency: data.equalSchedule.frequency,
        installments: data.equalSchedule.installments,
        loanId: loan.id,
        totalAmount: toMoney(totalAmount),
        totalInterest: toMoney(totalInterest),
        totalPrincipal: toMoney(totalPrincipal),
      }),
    });
  }

  await syncLoanStatus(loan.id);
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
      ...(data.counterpartId === undefined ? {} : { counterpartId: data.counterpartId }),
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
    (schedule: (typeof loan.schedules)[number]) =>
      schedule.paidAmount !== null || schedule.transactionId !== null
  );
  if (hasRegisteredPayments) {
    throw new DomainError(
      "CONFLICT",
      "No se puede regenerar un préstamo que ya tiene pagos registrados"
    );
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

  if (data.transactionId != null) {
    const transaction = await db.financialTransaction.findUnique({
      where: { id: data.transactionId },
      select: { id: true },
    });

    if (!transaction) {
      throw new DomainError("NOT_FOUND", "Transacción no encontrada");
    }
  }

  await db.loanSchedulePayment.create({
    data: {
      amount: toMoney(data.paidAmount),
      kind: data.kind ?? "PAYMENT",
      note: optionalNote(data.note),
      paidDate: toDateOnly(data.paidDate),
      scheduleId,
      transactionId: data.transactionId ?? null,
    },
  });

  const updated = await refreshSchedulePaymentSummary(scheduleId);
  await syncLoanStatus(schedule.loanId);

  return mapSchedule(updated);
}

export async function listLoanPaymentCandidates(
  scheduleId: number,
  params: LoanPaymentCandidatesPayload
) {
  const schedule = await db.loanSchedule.findUnique({
    where: { id: scheduleId },
    include: {
      loan: {
        select: {
          counterpartId: true,
        },
      },
    },
  });

  if (!schedule) {
    throw new DomainError("NOT_FOUND", "Cuota no encontrada");
  }

  if (!schedule.loan.counterpartId) {
    return [];
  }

  const from = addDays(schedule.dueDate, -params.daysBefore);
  const to = addDays(schedule.dueDate, params.daysAfter);
  const expectedAmount = toMoney(schedule.expectedAmount);

  const transactions = await db.financialTransaction.findMany({
    where: {
      counterpartId: schedule.loan.counterpartId,
      date: {
        gte: from,
        lte: to,
      },
    },
    include: {
      loanSchedulePayments: {
        select: {
          amount: true,
          id: true,
          scheduleId: true,
        },
      },
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    take: params.limit,
  });

  return transactions
    .map((transaction) => {
      const linkedPayments = transaction.loanSchedulePayments as LoanLinkedPaymentRow[];
      const alreadyLinkedAmount = linkedPayments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Decimal(0)
      );
      const transactionDate = dbDateToISO(transaction.date) ?? "";
      const dueDate = Temporal.PlainDate.from(dbDateToISO(schedule.dueDate) ?? "");
      const date = Temporal.PlainDate.from(transactionDate);
      const daysFromDue = date.since(dueDate).days;
      const remainingExpected = Decimal.max(expectedAmount.minus(schedule.paidAmount ?? 0), 0);
      const amountDelta = Decimal.abs(toMoney(transaction.amount).abs().minus(remainingExpected));
      const amountScore = Number(Decimal.max(new Decimal(100).minus(amountDelta.div(1000)), 0));
      const dateScore = Math.max(30 - Math.abs(daysFromDue) * 4, 0);
      const linkedPenalty = alreadyLinkedAmount.greaterThan(0) ? 25 : 0;

      return {
        already_linked_amount: Number(toMoney(alreadyLinkedAmount)),
        amount: Number(transaction.amount),
        date: transactionDate,
        days_from_due: daysFromDue,
        description: transaction.description,
        id: transaction.id,
        is_linked: alreadyLinkedAmount.greaterThan(0),
        score: Math.max(Math.round(amountScore + dateScore - linkedPenalty), 0),
        source_id: transaction.sourceId,
      };
    })
    .sort((a, b) => b.score - a.score || Math.abs(a.days_from_due) - Math.abs(b.days_from_due));
}

export async function unlinkLoanPayment(scheduleId: number) {
  const schedule = await ensureScheduleExists(scheduleId);

  await db.loanSchedulePayment.deleteMany({ where: { scheduleId } });
  const updated = await refreshSchedulePaymentSummary(scheduleId);

  await syncLoanStatus(schedule.loanId);

  return mapSchedule(updated);
}

export async function updateLoanSchedule(scheduleId: number, data: LoanScheduleUpdatePayload) {
  const schedule = await ensureScheduleExists(scheduleId);

  await db.loanSchedule.update({
    where: { id: scheduleId },
    data: {
      ...(data.dueDate === undefined ? {} : { dueDate: toDateOnly(data.dueDate) }),
      ...(data.expectedAmount === undefined
        ? {}
        : { expectedAmount: toMoney(data.expectedAmount) }),
      ...(data.expectedInterest === undefined
        ? {}
        : { expectedInterest: toMoney(data.expectedInterest) }),
      ...(data.expectedPrincipal === undefined
        ? {}
        : { expectedPrincipal: toMoney(data.expectedPrincipal) }),
      ...(data.note === undefined ? {} : { note: optionalNote(data.note) }),
    },
  });

  const updated = await refreshSchedulePaymentSummary(scheduleId);
  await syncLoanStatus(schedule.loanId);

  return mapSchedule(updated);
}
