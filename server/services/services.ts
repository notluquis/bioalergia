import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

export async function listServices() {
  return await prisma.service.findMany({
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
  return await prisma.service.findUnique({
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

export async function createService(data: Prisma.ServiceUncheckedCreateInput) {
  return await prisma.service.create({
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

export async function updateService(id: number, data: Prisma.ServiceUncheckedUpdateInput) {
  return await prisma.service.update({
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
  return await prisma.service.delete({
    where: { id },
  });
}
