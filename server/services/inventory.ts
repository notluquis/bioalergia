import { Prisma } from "@prisma/client";

import { prisma } from "../prisma.js";

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

export async function deleteInventoryCategory(id: number) {
  // Check if category has items
  const count = await prisma.inventoryItem.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error("Cannot delete category with associated items. Please move or delete items first.");
  }
  await prisma.inventoryCategory.delete({
    where: { id },
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
  return await prisma.$transaction(async (tx) => {
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
