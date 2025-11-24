import { prisma } from "../prisma.js";
import { Prisma, SupplyRequestStatus } from "../../generated/prisma/client.js";

// Supply Requests

export async function createSupplyRequest(data: {
  userId: number;
  supplyName: string;
  quantity: number;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
}) {
  return await prisma.supplyRequest.create({
    data: {
      userId: data.userId,
      supplyName: data.supplyName,
      quantity: data.quantity,
      brand: data.brand || null,
      model: data.model || null,
      notes: data.notes || null,
      status: "pending",
    },
  });
}

export async function listSupplyRequests(options: { role: string }) {
  const where: Prisma.SupplyRequestWhereInput = {};

  // Non-admins can only see pending, ordered, in_transit requests
  if (options.role !== "ADMIN" && options.role !== "GOD") {
    where.status = { in: ["pending", "ordered", "in_transit"] };
  }

  return await prisma.supplyRequest.findMany({
    where,
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateSupplyRequestStatus(id: number, status: SupplyRequestStatus, adminNotes?: string | null) {
  return await prisma.supplyRequest.update({
    where: { id },
    data: {
      status,
      adminNotes: adminNotes || null,
    },
  });
}

// Common Supplies

export async function listCommonSupplies() {
  return await prisma.commonSupply.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createCommonSupply(data: {
  name: string;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
}) {
  return await prisma.commonSupply.create({
    data: {
      name: data.name,
      brand: data.brand || null,
      model: data.model || null,
      description: data.description || null,
    },
  });
}

export async function updateCommonSupply(
  id: number,
  data: {
    name: string;
    brand?: string | null;
    model?: string | null;
    description?: string | null;
  }
) {
  return await prisma.commonSupply.update({
    where: { id },
    data: {
      name: data.name,
      brand: data.brand || null,
      model: data.model || null,
      description: data.description || null,
    },
  });
}

export async function deleteCommonSupply(id: number) {
  return await prisma.commonSupply.delete({
    where: { id },
  });
}
