import { db } from "@finanzas/db";

export async function getSupplyRequests() {
  return await db.supplyRequest.findMany({
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
  return await db.commonSupply.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createSupplyRequest(data: {
  userId: number;
  supplyName: string;
  quantity: number;
  brand?: string | null;
  model?: string | null;
  notes?: string | null;
}) {
  return await db.supplyRequest.create({
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
  return await db.supplyRequest.update({
    where: { id },
    data: { status },
  });
}
