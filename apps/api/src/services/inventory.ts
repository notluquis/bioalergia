import { db } from "@finanzas/db";

export async function listInventoryCategories() {
  return await db.inventoryCategory.findMany({
    orderBy: { name: "asc" },
  });
}

export async function createInventoryCategory(name: string) {
  return await db.inventoryCategory.create({
    data: { name },
  });
}

export async function deleteInventoryCategory(id: number) {
  // Check if category has items
  const count = await db.inventoryItem.count({ where: { categoryId: id } });
  if (count > 0) {
    throw new Error(
      "Cannot delete category with associated items. Please move or delete items first.",
    );
  }
  await db.inventoryCategory.delete({
    where: { id },
  });
}

export async function listInventoryItems() {
  const items = await db.inventoryItem.findMany({
    include: {
      category: true,
    },
    orderBy: { name: "asc" },
  });
  return items.map((item) => ({
    ...item,
    category_name: item.category?.name,
  }));
}

export async function createInventoryItem(data: {
  name: string;
  description?: string | null;
  currentStock: number;
  categoryId?: number | null;
}) {
  return await db.inventoryItem.create({
    data,
    include: { category: true },
  });
}

export async function updateInventoryItem(
  id: number,
  data: {
    name?: string;
    description?: string | null;
    currentStock?: number;
    categoryId?: number | null;
  },
) {
  return await db.inventoryItem.update({
    where: { id },
    data,
    include: { category: true },
  });
}

export async function deleteInventoryItem(id: number) {
  await db.inventoryItem.delete({
    where: { id },
  });
}

export async function createInventoryMovement(data: {
  itemId: number;
  quantityChange: number;
  reason?: string;
}) {
  return await db.$transaction(async (tx) => {
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
