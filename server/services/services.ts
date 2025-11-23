import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import dayjs from "dayjs";
import { roundCurrency } from "../../shared/currency.js";

import { randomUUID } from "node:crypto";

const FREQUENCY_CONFIG: Record<string, { amount: number; unit: dayjs.ManipulateType }> = {
  WEEKLY: { amount: 1, unit: "week" },
  BIWEEKLY: { amount: 2, unit: "week" },
  MONTHLY: { amount: 1, unit: "month" },
  BIMONTHLY: { amount: 2, unit: "month" },
  QUARTERLY: { amount: 3, unit: "month" },
  SEMIANNUAL: { amount: 6, unit: "month" },
  ANNUAL: { amount: 1, unit: "year" },
  ONCE: { amount: 1, unit: "month" }, // Default fallback
};

type ServiceScheduleItem = {
  period_start: Date;
  period_end: Date;
  due_date: Date;
  expected_amount: number;
};

function computeServiceSchedule(
  service: Prisma.ServiceGetPayload<{}>,
  overrides?: {
    months?: number;
    startDate?: string;
    defaultAmount?: number;
    dueDay?: number | null;
    emissionDay?: number | null;
    frequency?: string;
  }
): ServiceScheduleItem[] {
  const frequency = overrides?.frequency ?? service.frequency;
  const config = FREQUENCY_CONFIG[frequency];
  if (!config) {
    throw new Error("Frecuencia de servicio no soportada");
  }

  const rawPeriods = overrides?.months ?? service.nextGenerationMonths;
  const totalPeriods =
    frequency === "ONCE" || service.recurrenceType === "ONE_OFF" ? Math.min(rawPeriods, 1) : rawPeriods;
  const baseAmount = overrides?.defaultAmount ?? Number(service.defaultAmount);
  if (totalPeriods <= 0) return [];

  const schedule: ServiceScheduleItem[] = [];
  const startDateStr =
    overrides?.startDate ?? (service.startDate instanceof Date ? service.startDate.toISOString() : service.startDate);
  let cursor = dayjs(startDateStr).startOf("day");
  const dueDay = overrides?.dueDay ?? service.dueDay ?? null;

  for (let i = 0; i < totalPeriods; i += 1) {
    const periodStart = cursor;
    const periodEnd = cursor.add(config.amount, config.unit).subtract(1, "day");
    let dueDate = periodEnd;
    if (config.unit === "month" || config.unit === "year") {
      if (dueDay != null) {
        const candidate = periodStart.startOf("month").date(dueDay);
        if (candidate.month() !== periodStart.month()) {
          dueDate = periodStart.endOf("month");
        } else {
          dueDate = candidate;
        }
      }
    }

    schedule.push({
      period_start: periodStart.toDate(),
      period_end: periodEnd.toDate(),
      due_date: dueDate.toDate(),
      expected_amount: roundCurrency(baseAmount),
    });

    cursor = periodEnd.add(1, "day");
  }

  return schedule;
}

function applyDerivedScheduleAmounts(
  service: Prisma.ServiceGetPayload<{}>,
  schedule: Prisma.ServiceScheduleGetPayload<{ include: { transaction: true } }>
) {
  const today = dayjs().startOf("day");
  const dueDate = dayjs(schedule.dueDate);
  const overdueDays = Math.max(0, today.diff(dueDate, "day"));

  let lateFee = 0;
  if (
    service.lateFeeMode !== "NONE" &&
    !["PAID", "SKIPPED"].includes(schedule.status) &&
    overdueDays > (service.lateFeeGraceDays ?? 0)
  ) {
    const baseline = Number(schedule.expectedAmount);
    const feeValue = Number(service.lateFeeValue ?? 0);
    if (service.lateFeeMode === "FIXED") {
      lateFee = feeValue;
    } else {
      lateFee = roundCurrency(baseline * (feeValue / 100));
    }
  }

  const effectiveAmount = roundCurrency(Number(schedule.expectedAmount) + lateFee);

  return {
    ...schedule,
    lateFeeAmount: roundCurrency(lateFee),
    effectiveAmount,
    overdueDays,
  };
}

export async function listServicesWithSummary() {
  const services = await prisma.service.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      counterpart: true,
      counterpartAccount: true,
      schedules: true,
    },
  });

  return services.map(
    (
      service: Prisma.ServiceGetPayload<{ include: { schedules: true; counterpart: true; counterpartAccount: true } }>
    ) => {
      const summary = service.schedules.reduce(
        (
          acc: { total_expected: number; total_paid: number; pending_count: number; overdue_count: number },
          s: Prisma.ServiceScheduleGetPayload<{}>
        ) => {
          acc.total_expected += Number(s.expectedAmount);
          if (["PAID", "PARTIAL"].includes(s.status)) {
            acc.total_paid += Number(s.paidAmount ?? s.expectedAmount);
          }
          if (["PENDING", "PARTIAL"].includes(s.status)) {
            acc.pending_count += 1;
            if (s.status === "PENDING" && s.dueDate && dayjs(s.dueDate).isBefore(dayjs().startOf("day"))) {
              acc.overdue_count += 1;
            }
          }
          return acc;
        },
        {
          total_expected: 0,
          total_paid: 0,
          pending_count: 0,
          overdue_count: 0,
        }
      );

      return {
        ...service,
        counterpartName: service.counterpart?.name ?? null,
        counterpartAccountIdentifier: service.counterpartAccount?.accountIdentifier ?? null,
        counterpartAccountBankName: service.counterpartAccount?.bankName ?? null,
        counterpartAccountType: service.counterpartAccount?.accountType ?? null,
        summary,
      };
    }
  );
}

export async function getServiceDetail(publicId: string) {
  const service = await prisma.service.findUnique({
    where: { publicId },
    include: {
      counterpart: true,
      counterpartAccount: true,
      schedules: {
        orderBy: { periodStart: "asc" },
        include: {
          transaction: true,
        },
      },
    },
  });

  if (!service) return null;

  const schedules = service.schedules.map((s: Prisma.ServiceScheduleGetPayload<{ include: { transaction: true } }>) =>
    applyDerivedScheduleAmounts(service, s)
  );

  const aggregates = schedules.reduce(
    (
      acc: { totalExpected: number; totalPaid: number; pendingCount: number; overdueCount: number },
      schedule: ReturnType<typeof applyDerivedScheduleAmounts>
    ) => {
      acc.totalExpected += Number(schedule.expectedAmount);
      if (["PAID", "PARTIAL"].includes(schedule.status)) {
        acc.totalPaid += Number(schedule.paidAmount ?? schedule.expectedAmount);
      }
      if (["PENDING", "PARTIAL"].includes(schedule.status)) {
        acc.pendingCount += 1;
        if (schedule.status === "PENDING" && schedule.overdueDays > 0) {
          acc.overdueCount += 1;
        }
      }
      return acc;
    },
    {
      totalExpected: 0,
      totalPaid: 0,
      pendingCount: 0,
      overdueCount: 0,
    }
  );

  const serviceWithSummary = {
    ...service,
    counterpartName: service.counterpart?.name ?? null,
    counterpartAccountIdentifier: service.counterpartAccount?.accountIdentifier ?? null,
    counterpartAccountBankName: service.counterpartAccount?.bankName ?? null,
    counterpartAccountType: service.counterpartAccount?.accountType ?? null,
    total_expected: roundCurrency(aggregates.totalExpected),
    total_paid: roundCurrency(aggregates.totalPaid),
    pending_count: aggregates.pendingCount,
    overdue_count: aggregates.overdueCount,
  };

  return { service: serviceWithSummary, schedules };
}

export async function createService(data: Omit<Prisma.ServiceUncheckedCreateInput, "publicId">) {
  const publicId = randomUUID();
  const service = await prisma.service.create({
    data: {
      ...data,
      publicId,
      status: "ACTIVE",
    },
    include: {
      counterpart: true,
      counterpartAccount: true,
    },
  });
  return service;
}

export async function updateService(publicId: string, data: Prisma.ServiceUncheckedUpdateInput) {
  const service = await prisma.service.update({
    where: { publicId },
    data: {
      ...data,
      updatedAt: new Date(),
    },
    include: {
      counterpart: true,
      counterpartAccount: true,
    },
  });
  return service;
}

export async function regenerateServiceSchedule(
  publicId: string,
  overrides?: {
    months?: number;
    startDate?: string;
    defaultAmount?: number;
    dueDay?: number | null;
    frequency?: string;
    emissionDay?: number | null;
  }
) {
  const service = await prisma.service.findUnique({ where: { publicId } });
  if (!service) throw new Error("Servicio no encontrado");

  const schedule = computeServiceSchedule(service, overrides);

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.serviceSchedule.deleteMany({ where: { serviceId: service.id } });

    await tx.serviceSchedule.createMany({
      data: schedule.map((s) => ({
        serviceId: service.id,
        periodStart: new Date(s.period_start),
        periodEnd: new Date(s.period_end),
        dueDate: new Date(s.due_date),
        expectedAmount: s.expected_amount,
        status: "PENDING",
      })),
    });

    // Update service status based on new schedule
    // Logic simplified: if any pending, active. if all paid/skipped, inactive?
    // Original logic: if pending_count == 0 -> INACTIVE. if overdue > 0 -> ACTIVE.
    // We'll stick to ACTIVE for now as regeneration implies activity.
    await tx.service.update({
      where: { id: service.id },
      data: { status: "ACTIVE" },
    });
  });
}

export async function markServicePayment(payload: {
  scheduleId: number;
  transactionId: number;
  paidAmount: number;
  paidDate: string;
  note?: string | null;
}) {
  const schedule = await prisma.serviceSchedule.findUnique({
    where: { id: payload.scheduleId },
    include: { service: true },
  });
  if (!schedule) throw new Error("Periodo no encontrado");

  // Calculate effective amount before payment to determine status
  const derivedBefore = applyDerivedScheduleAmounts(schedule.service, { ...schedule, transaction: null });

  const paidAmount = roundCurrency(payload.paidAmount);
  const targetAmount = derivedBefore.effectiveAmount;
  const status = paidAmount >= targetAmount ? "PAID" : "PARTIAL";

  const updated = await prisma.serviceSchedule.update({
    where: { id: payload.scheduleId },
    data: {
      transactionId: payload.transactionId,
      paidAmount,
      paidDate: new Date(payload.paidDate),
      note: payload.note,
      status,
    },
    include: { transaction: true },
  });

  return applyDerivedScheduleAmounts(schedule.service, updated);
}

export async function unlinkServicePayment(scheduleId: number) {
  const schedule = await prisma.serviceSchedule.findUnique({
    where: { id: scheduleId },
    include: { service: true },
  });
  if (!schedule) throw new Error("Periodo no encontrado");

  const updated = await prisma.serviceSchedule.update({
    where: { id: scheduleId },
    data: {
      transactionId: null,
      paidAmount: null,
      paidDate: null,
      note: null,
      status: "PENDING",
    },
    include: { transaction: true },
  });

  return applyDerivedScheduleAmounts(schedule.service, updated);
}
