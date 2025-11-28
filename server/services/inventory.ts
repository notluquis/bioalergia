import { prisma } from "../prisma.js";
import { Prisma } from "@prisma/client";

export async function listInventoryCategories() {
  return await prisma.inventoryCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createInventoryCategory(name: string) {
  return await prisma.inventoryCategory.create({
    data: { name },
  });
}

export async function listInventoryItems() {
  const items = await prisma.inventoryItem.findMany({
    include: {
      category: true,
    },
    orderBy: { name: "asc" },
  });
  return items.map((item: Prisma.InventoryItemGetPayload<{ include: { category: true } }>) => ({
    ...item,
    category_name: item.category?.name,
  }));
}

export async function createInventoryItem(data: Prisma.InventoryItemUncheckedCreateInput) {
  return await prisma.inventoryItem.create({
    data,
    include: { category: true },
  });
}

export async function updateInventoryItem(id: number, data: Prisma.InventoryItemUncheckedUpdateInput) {
  return await prisma.inventoryItem.update({
    where: { id },
    data,
    include: { category: true },
  });
}

export async function deleteInventoryItem(id: number) {
  await prisma.inventoryItem.delete({
    where: { id },
  });
}

export async function createInventoryMovement(data: { itemId: number; quantityChange: number; reason?: string }) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.inventoryMovement.create({
      data: {
        itemId: data.itemId,
        quantityChange: data.quantityChange,
        reason: data.reason,
      },
    });
    await tx.inventoryItem.update({
      where: { id: data.itemId },
      data: {
        currentStock: { increment: data.quantityChange },
      },
    });
  });
}
