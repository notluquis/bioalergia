import {
  db,
  type ServiceAmountIndexation,
  type ServiceEmissionMode,
  type ServiceFrequency,
  type ServiceLateFeeMode,
  type ServiceObligationType,
  type ServiceOwnership,
  type ServiceRecurrenceType,
  type ServiceStatus,
  type ServiceType,
} from "@finanzas/db";
import type { ServiceInclude } from "@finanzas/db/input";
import { Decimal } from "decimal.js";

type ServicePayload = {
  name: string;
  serviceType: ServiceType;
  frequency: ServiceFrequency;
  defaultAmount: number;
  detail?: string | null;
  category?: string | null;
  counterpartId?: number | null;
  recurrenceType?: ServiceRecurrenceType;
  startDate?: string;
  endDate?: string | null;
  dueDay?: number | null;
  emissionMode?: ServiceEmissionMode;
  emissionDay?: number | null;
  emissionStartDay?: number | null;
  emissionEndDay?: number | null;
  emissionExactDate?: string | null;
  ownership?: ServiceOwnership;
  obligationType?: ServiceObligationType;
  amountIndexation?: ServiceAmountIndexation;
  lateFeeMode?: ServiceLateFeeMode;
  lateFeeValue?: number | null;
  lateFeeGraceDays?: number | null;
  monthsToGenerate?: number;
  notes?: string | null;
  transactionCategoryId?: number | null;
  reminderDaysBefore?: number;
  autoLinkTransactions?: boolean;
  status?: ServiceStatus;
};

type ServiceUpdatePayload = Partial<ServicePayload>;

const toDecimal = (value: number) => new Decimal(value);

const serviceInclude: ServiceInclude = {
  counterpart: true,
  transactionCategory: true,
};

export async function listServices() {
  return await db.service.findMany({
    orderBy: { createdAt: "desc" },
    include: serviceInclude,
  });
}

export async function getServiceById(id: number) {
  return await db.service.findUnique({
    where: { id },
    include: serviceInclude,
  });
}

export async function getServiceByIdOrPublicId(identifier: string | number) {
  const numericId = typeof identifier === "number" ? identifier : Number(identifier);

  if (!Number.isNaN(numericId)) {
    return await db.service.findUnique({
      where: { id: numericId },
      include: serviceInclude,
    });
  }

  return await db.service.findUnique({
    where: { publicId: identifier as string },
    include: serviceInclude,
  });
}

export async function createService(data: ServicePayload) {
  const publicId = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startDate = data.startDate ? new Date(data.startDate) : new Date();

  return await db.service.create({
    data: {
      publicId,
      name: data.name,
      detail: data.detail ?? null,
      category: data.category ?? null,
      type: data.serviceType,
      recurrenceType: data.recurrenceType ?? "RECURRING",
      frequency: data.frequency,
      startDate,
      endDate: data.endDate ? new Date(data.endDate) : null,
      dueDay: data.dueDay ?? null,
      emissionMode: data.emissionMode ?? "FIXED_DAY",
      emissionDay: data.emissionDay ?? null,
      emissionStartDay: data.emissionStartDay ?? null,
      emissionEndDay: data.emissionEndDay ?? null,
      emissionExactDate: data.emissionExactDate ? new Date(data.emissionExactDate) : null,
      ownership: data.ownership ?? "COMPANY",
      obligationType: data.obligationType ?? "SERVICE",
      defaultAmount: toDecimal(data.defaultAmount),
      amountIndexation: data.amountIndexation ?? "NONE",
      lateFeeMode: data.lateFeeMode ?? "NONE",
      lateFeeValue: data.lateFeeValue != null ? toDecimal(data.lateFeeValue) : null,
      lateFeeGraceDays: data.lateFeeGraceDays ?? null,
      nextGenerationMonths: data.monthsToGenerate ?? 12,
      notes: data.notes ?? null,
      counterpartId: data.counterpartId ?? null,
      transactionCategoryId: data.transactionCategoryId ?? null,
      reminderDaysBefore: data.reminderDaysBefore ?? 3,
      autoLinkTransactions: data.autoLinkTransactions ?? true,
      status: data.status ?? "ACTIVE",
    },
    include: serviceInclude,
  });
}

export async function updateService(id: number, data: ServiceUpdatePayload) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.detail !== undefined) {
    updateData.detail = data.detail;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.serviceType !== undefined) {
    updateData.type = data.serviceType;
  }
  if (data.recurrenceType !== undefined) {
    updateData.recurrenceType = data.recurrenceType;
  }
  if (data.frequency !== undefined) {
    updateData.frequency = data.frequency;
  }
  if (data.startDate !== undefined) {
    updateData.startDate = new Date(data.startDate);
  }
  if (data.endDate !== undefined) {
    updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  }
  if (data.dueDay !== undefined) {
    updateData.dueDay = data.dueDay;
  }
  if (data.emissionMode !== undefined) {
    updateData.emissionMode = data.emissionMode;
  }
  if (data.emissionDay !== undefined) {
    updateData.emissionDay = data.emissionDay;
  }
  if (data.emissionStartDay !== undefined) {
    updateData.emissionStartDay = data.emissionStartDay;
  }
  if (data.emissionEndDay !== undefined) {
    updateData.emissionEndDay = data.emissionEndDay;
  }
  if (data.emissionExactDate !== undefined) {
    updateData.emissionExactDate = data.emissionExactDate ? new Date(data.emissionExactDate) : null;
  }
  if (data.ownership !== undefined) {
    updateData.ownership = data.ownership;
  }
  if (data.obligationType !== undefined) {
    updateData.obligationType = data.obligationType;
  }
  if (data.defaultAmount !== undefined) {
    updateData.defaultAmount = toDecimal(data.defaultAmount);
  }
  if (data.amountIndexation !== undefined) {
    updateData.amountIndexation = data.amountIndexation;
  }
  if (data.lateFeeMode !== undefined) {
    updateData.lateFeeMode = data.lateFeeMode;
  }
  if (data.lateFeeValue !== undefined) {
    updateData.lateFeeValue = data.lateFeeValue != null ? toDecimal(data.lateFeeValue) : null;
  }
  if (data.lateFeeGraceDays !== undefined) {
    updateData.lateFeeGraceDays = data.lateFeeGraceDays;
  }
  if (data.monthsToGenerate !== undefined) {
    updateData.nextGenerationMonths = data.monthsToGenerate;
  }
  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }
  if (data.counterpartId !== undefined) {
    updateData.counterpartId = data.counterpartId;
  }
  if (data.transactionCategoryId !== undefined) {
    updateData.transactionCategoryId = data.transactionCategoryId;
  }
  if (data.reminderDaysBefore !== undefined) {
    updateData.reminderDaysBefore = data.reminderDaysBefore;
  }
  if (data.autoLinkTransactions !== undefined) {
    updateData.autoLinkTransactions = data.autoLinkTransactions;
  }
  if (data.status !== undefined) {
    updateData.status = data.status;
  }
  return await db.service.update({
    where: { id },
    data: updateData,
    include: serviceInclude,
  });
}

export async function deleteService(id: number) {
  return await db.service.delete({
    where: { id },
  });
}

type GenerateSchedulesOptions = {
  serviceId: number;
  months?: number;
  fromDate?: Date;
};

export async function generateSchedules(options: GenerateSchedulesOptions) {
  const { serviceId, months = 12, fromDate } = options;

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error("Service not found");
  }

  if (service.recurrenceType === "ONE_OFF") {
    return { generated: 0, message: "Service is one-off, no schedules generated" };
  }

  if (service.frequency !== "MONTHLY") {
    return { generated: 0, message: "Only MONTHLY frequency is supported for now" };
  }

  const startFrom = fromDate ?? new Date(service.startDate);
  const schedules: Array<{
    serviceId: number;
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
    expectedAmount: Decimal;
    lateFeeAmount: Decimal;
    effectiveAmount: Decimal;
    status: "PENDING";
  }> = [];

  for (let i = 0; i < months; i++) {
    const periodStart = new Date(startFrom.getFullYear(), startFrom.getMonth() + i, 1);
    const periodEnd = new Date(startFrom.getFullYear(), startFrom.getMonth() + i + 1, 0);

    if (service.endDate && periodStart > new Date(service.endDate)) {
      break;
    }

    const dueDay = service.dueDay ?? 1;
    const dueDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), dueDay);
    if (dueDate < periodStart) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }

    const existing = await db.serviceSchedule.findUnique({
      where: {
        serviceId_periodStart: {
          serviceId,
          periodStart,
        },
      },
    });

    if (existing) {
      continue;
    }

    const expectedAmount = service.defaultAmount;
    const lateFeeAmount = new Decimal(0);
    const effectiveAmount = expectedAmount.plus(lateFeeAmount);

    schedules.push({
      serviceId,
      periodStart,
      periodEnd,
      dueDate,
      expectedAmount,
      lateFeeAmount,
      effectiveAmount,
      status: "PENDING",
    });
  }

  if (schedules.length === 0) {
    return { generated: 0, message: "No new schedules to generate" };
  }

  await db.serviceSchedule.createMany({
    data: schedules,
  });

  return { generated: schedules.length, message: `Generated ${schedules.length} schedules` };
}

type SyncServiceSchedulesResult = {
  matchedSchedules: number;
  processedSchedules: number;
  scannedTransactions: number;
  servicesCount: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toAmountNumber(value: Decimal | number | string): number {
  return Number(value);
}

function getAbsAmount(value: Decimal | number | string): number {
  return Math.abs(toAmountNumber(value));
}

function getAmountTolerance(expectedAmount: number): number {
  return Math.max(1000, expectedAmount * 0.25);
}

export async function syncServiceSchedulesWithFinancialTransactions(
  servicePublicId?: string,
): Promise<SyncServiceSchedulesResult> {
  const serviceFilter = servicePublicId
    ? { publicId: servicePublicId }
    : {
        autoLinkTransactions: true,
        status: "ACTIVE" as const,
        transactionCategoryId: { not: null as null | number },
      };

  const services = await db.service.findMany({
    where: serviceFilter,
    select: {
      autoLinkTransactions: true,
      id: true,
      publicId: true,
      transactionCategoryId: true,
    },
  });

  const eligibleServices = services.filter(
    (service) => service.autoLinkTransactions && service.transactionCategoryId != null,
  );
  if (eligibleServices.length === 0) {
    return {
      matchedSchedules: 0,
      processedSchedules: 0,
      scannedTransactions: 0,
      servicesCount: 0,
    };
  }

  const serviceIds = eligibleServices.map((service) => service.id);
  const categoryIds = Array.from(
    new Set(
      eligibleServices
        .map((service) => service.transactionCategoryId)
        .filter((value): value is number => value != null),
    ),
  );
  const serviceById = new Map(eligibleServices.map((service) => [service.id, service]));

  const schedules = await db.serviceSchedule.findMany({
    where: {
      serviceId: { in: serviceIds },
      status: { in: ["PENDING", "PARTIAL"] },
      financialTransactionId: null,
      releaseTransactionId: null,
      settlementTransactionId: null,
      withdrawTransactionId: null,
    },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  if (schedules.length === 0) {
    return {
      matchedSchedules: 0,
      processedSchedules: 0,
      scannedTransactions: 0,
      servicesCount: eligibleServices.length,
    };
  }

  const minDate = new Date(
    Math.min(...schedules.map((schedule) => schedule.periodStart.getTime())) - 7 * DAY_IN_MS,
  );
  const maxDate = new Date(
    Math.max(...schedules.map((schedule) => schedule.dueDate.getTime())) + 7 * DAY_IN_MS,
  );

  const alreadyLinkedRows = await db.serviceSchedule.findMany({
    where: { financialTransactionId: { not: null } },
    select: { financialTransactionId: true },
  });

  const blockedTransactionIds = alreadyLinkedRows
    .map((row) => row.financialTransactionId)
    .filter((value): value is number => value != null);

  const candidateTransactions = await db.financialTransaction.findMany({
    where: {
      categoryId: { in: categoryIds },
      date: { gte: minDate, lte: maxDate },
      type: "EXPENSE",
      ...(blockedTransactionIds.length > 0 ? { id: { notIn: blockedTransactionIds } } : {}),
    },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });

  const transactionsByCategory = new Map<number, typeof candidateTransactions>();
  for (const transaction of candidateTransactions) {
    if (transaction.categoryId == null) {
      continue;
    }
    const list = transactionsByCategory.get(transaction.categoryId) ?? [];
    list.push(transaction);
    transactionsByCategory.set(transaction.categoryId, list);
  }

  const consumedTransactionIds = new Set<number>();
  let matchedSchedules = 0;

  for (const schedule of schedules) {
    const service = serviceById.get(schedule.serviceId);
    if (!service || service.transactionCategoryId == null) {
      continue;
    }

    const categoryTransactions = transactionsByCategory.get(service.transactionCategoryId) ?? [];
    if (categoryTransactions.length === 0) {
      continue;
    }

    const expectedAmount = getAbsAmount(schedule.effectiveAmount);
    if (expectedAmount <= 0) {
      continue;
    }

    const windowStart = schedule.periodStart.getTime() - 7 * DAY_IN_MS;
    const windowEnd = schedule.dueDate.getTime() + 7 * DAY_IN_MS;
    const tolerance = getAmountTolerance(expectedAmount);

    let bestMatch: (typeof candidateTransactions)[number] | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const transaction of categoryTransactions) {
      if (consumedTransactionIds.has(transaction.id)) {
        continue;
      }

      const txDate = transaction.date.getTime();
      if (txDate < windowStart || txDate > windowEnd) {
        continue;
      }

      const txAmount = getAbsAmount(transaction.amount);
      const amountDiff = Math.abs(txAmount - expectedAmount);
      if (amountDiff > tolerance) {
        continue;
      }

      const dayDiff = Math.abs(txDate - schedule.dueDate.getTime()) / DAY_IN_MS;
      const score = amountDiff + dayDiff * 100;

      if (score < bestScore) {
        bestScore = score;
        bestMatch = transaction;
      }
    }

    if (!bestMatch) {
      continue;
    }

    const paidAmount = getAbsAmount(bestMatch.amount);
    const status = paidAmount >= expectedAmount ? "PAID" : "PARTIAL";

    await db.serviceSchedule.update({
      where: { id: schedule.id },
      data: {
        financialTransactionId: bestMatch.id,
        paidAmount: new Decimal(paidAmount),
        paidDate: bestMatch.date,
        status,
      },
    });

    consumedTransactionIds.add(bestMatch.id);
    matchedSchedules += 1;
  }

  return {
    matchedSchedules,
    processedSchedules: schedules.length,
    scannedTransactions: candidateTransactions.length,
    servicesCount: eligibleServices.length,
  };
}
