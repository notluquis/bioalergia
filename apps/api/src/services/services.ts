import { db, type ServiceFrequency, type ServiceStatus, type ServiceType } from "@finanzas/db";
import type { ServiceInclude } from "@finanzas/db/input";
import { Decimal } from "decimal.js";

type ServicePayload = {
  name: string;
  serviceType: ServiceType;
  frequency: ServiceFrequency;
  defaultAmount: number;
  counterpartId?: number | null;
  status?: ServiceStatus;
};

type ServiceUpdatePayload = Partial<ServicePayload>;

const toDecimal = (value: number) => new Decimal(value);

const serviceInclude: ServiceInclude = {
  counterpart: true,
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

export async function createService(data: ServicePayload) {
  const publicId = `srv_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const startDate = new Date();

  return await db.service.create({
    data: {
      publicId,
      name: data.name,
      type: data.serviceType,
      frequency: data.frequency,
      startDate,
      defaultAmount: toDecimal(data.defaultAmount),
      counterpartId: data.counterpartId ?? null,
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
  if (data.serviceType !== undefined) {
    updateData.type = data.serviceType;
  }
  if (data.frequency !== undefined) {
    updateData.frequency = data.frequency;
  }
  if (data.defaultAmount !== undefined) {
    updateData.defaultAmount = toDecimal(data.defaultAmount);
  }
  if (data.counterpartId !== undefined) {
    updateData.counterpartId = data.counterpartId;
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
