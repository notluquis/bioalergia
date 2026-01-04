import { accessibleBy } from "@casl/prisma";
import { Prisma } from "@prisma/client";

import type { AppAbility } from "../lib/authz/ability.js";
import { prisma } from "../prisma.js";

export async function listServices(ability?: AppAbility) {
  const where: Prisma.ServiceWhereInput = {};

  if (ability) {
    Object.assign(where, accessibleBy(ability).Service);
  }

  return await prisma.service.findMany({
    where,
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
