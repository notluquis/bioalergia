import type { ServiceCreateArgs, ServiceUpdateArgs } from "@finanzas/db";
import { db } from "@finanzas/db";

// Extract input types from Zenstack args
type ServiceCreateInput = NonNullable<ServiceCreateArgs["data"]>;
type ServiceUpdateInput = NonNullable<ServiceUpdateArgs["data"]>;

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

export async function createService(data: ServiceCreateInput) {
  return await db.service.create({
    data,
    include: {
      counterpart: {
        include: {
          person: true,
        },
      },
    },
  });
}

export async function updateService(id: number, data: ServiceUpdateInput) {
  return await db.service.update({
    where: { id },
    data,
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
