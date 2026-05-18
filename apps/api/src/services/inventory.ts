import { db } from "@finanzas/db";
import type { InventoryMovementWhereInput } from "@finanzas/db/input";

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
      "Cannot delete category with associated items. Please move or delete items first."
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
  }
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

export async function listInventoryMovements(params: {
  cursor?: number;
  from?: string;
  itemId?: number;
  limit: number;
  search?: string;
  to?: string;
}) {
  const where: InventoryMovementWhereInput = {};

  if (params.itemId !== undefined) {
    where.itemId = params.itemId;
  }

  if (params.from !== undefined || params.to !== undefined) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (params.from !== undefined) {
      const fromDate = new Date(params.from);
      if (!Number.isNaN(fromDate.getTime())) {
        createdAt.gte = fromDate;
      }
    }
    if (params.to !== undefined) {
      const toDate = new Date(params.to);
      if (!Number.isNaN(toDate.getTime())) {
        createdAt.lte = toDate;
      }
    }
    if (createdAt.gte !== undefined || createdAt.lte !== undefined) {
      where.createdAt = createdAt;
    }
  }

  if (params.search !== undefined && params.search.trim().length > 0) {
    const q = params.search.trim();
    where.item = {
      OR: [
        { name: { contains: q, mode: "insensitive" as const } },
        { description: { contains: q, mode: "insensitive" as const } },
      ],
    };
  }

  // Fetch limit+1 to compute nextCursor without an extra query.
  const take = params.limit + 1;
  const rows = await db.inventoryMovement.findMany({
    cursor: params.cursor !== undefined ? { id: params.cursor } : undefined,
    include: { item: true },
    orderBy: { id: "desc" },
    skip: params.cursor !== undefined ? 1 : 0,
    take,
    where,
  });

  const hasMore = rows.length > params.limit;
  const sliced = hasMore ? rows.slice(0, params.limit) : rows;
  const lastRow = sliced.at(-1);
  const nextCursor = hasMore && lastRow ? lastRow.id : null;

  return {
    movements: sliced,
    nextCursor,
  };
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
