import { prisma } from "../prisma.js";

export async function getSupplyRequests() {
  return await prisma.supplyRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          email: true,
          person: {
            select: {
              names: true,
              fatherName: true,
            },
          },
        },
      },
    },
  });
}

export async function getCommonSupplies() {
  return await prisma.commonSupply.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createSupplyRequest(data: {
  userId: number;
  supplyName: string;
  quantity: number;
  brand?: string;
  model?: string;
  notes?: string;
}) {
  return await prisma.supplyRequest.create({
    data: {
      userId: data.userId,
      supplyName: data.supplyName,
      quantity: data.quantity,
      brand: data.brand,
      model: data.model,
      notes: data.notes,
      status: "PENDING",
    },
  });
}

export async function updateSupplyRequestStatus(id: number, status: string) {
  return await prisma.supplyRequest.update({
    where: { id },
    data: { status },
  });
}
