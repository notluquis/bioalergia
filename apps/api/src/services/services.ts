import { db, type ServiceFrequency, type ServiceStatus, type ServiceType } from "@finanzas/db";
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

export async function listServices() {
  return await db.service.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      counterpart: {
        include: {
          person: true,
        },
      },
    },
  });
}

export async function getServiceById(id: number) {
  return await db.service.findUnique({
    where: { id },
    include: {
      counterpart: {
        include: {
          person: true,
        },
      },
    },
  });
}

export async function createService(data: ServicePayload) {
  return await db.service.create({
    data: {
      name: data.name,
      type: data.serviceType,
      frequency: data.frequency,
      defaultAmount: toDecimal(data.defaultAmount),
      counterpartId: data.counterpartId ?? null,
      status: data.status ?? "ACTIVE",
    },
    include: {
      counterpart: {
        include: {
          person: true,
        },
      },
    },
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
    include: {
      counterpart: {
        include: {
          person: true,
        },
      },
    },
  });
}

export async function deleteService(id: number) {
  return await db.service.delete({
    where: { id },
  });
}
