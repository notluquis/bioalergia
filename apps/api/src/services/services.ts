import { db } from "@finanzas/db";

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

export async function createService(data: any) {
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

export async function updateService(id: number, data: any) {
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
