import { prisma } from "../prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

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
  // Map to match the expected shape if needed, or just return items.
  // The route expects { ...item, category_name: string }
  return items.map((item: Prisma.InventoryItemGetPayload<{ include: { category: true } }>) => ({
    ...item,
    category_name: item.category?.name,
  }));
}

export async function createInventoryItem(data: Prisma.InventoryItemCreateInput) {
  return await prisma.inventoryItem.create({
    data,
    include: { category: true },
  });
}

export async function updateInventoryItem(id: number, data: Prisma.InventoryItemUpdateInput) {
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

export async function createInventoryProviderCheck(
  itemProviderId: number,
  data: {
    checkType: string;
    quantity?: number | null;
    price?: number | null;
    notes?: string | null;
    transactionId?: number | null;
  }
) {
  return await prisma.inventoryProviderCheck.create({
    data: {
      itemProviderId,
      checkType: data.checkType,
      quantity: data.quantity,
      price: data.price,
      notes: data.notes,
      transactionId: data.transactionId,
    },
  });
}

export async function listAllergyInventoryOverview() {
  const items = await prisma.inventoryItem.findMany({
    include: {
      category: true,
      allergyType: {
        include: {
          parent: {
            include: {
              parent: true,
            },
          },
        },
      },
      itemProviders: {
        include: {
          provider: {
            include: {
              accounts: true,
            },
          },
        },
      },
    },
  });

  // Transform to match AllergyInventoryOverview type
  const overview = items.map(
    (
      item: Prisma.InventoryItemGetPayload<{
        include: {
          category: true;
          allergyType: { include: { parent: { include: { parent: true } } } };
          itemProviders: { include: { provider: { include: { accounts: true } } } };
        };
      }>
    ) => {
      // Determine hierarchy
      let subtype = item.allergyType;
      let category = subtype?.parent;
      let root = category?.parent;

      // Handle cases where hierarchy might be shallower
      // The schema defines parentId, so we traverse up.
      // If item.allergyType has no parent, it might be a root or category itself depending on 'level'.
      // But the original query assumes a 3-level hierarchy: root -> parent -> subtype.
      // Let's trust the original query logic which joins subtype, parent, root.

      // If the hierarchy is incomplete, we might need to adjust.
      // For now, let's map what we have.

      const providers = item.itemProviders.map(
        (ip: {
          providerId: number;
          provider: { name: string; rut: string; accounts: { accountIdentifier: string }[] };
          currentPrice: number | null;
          lastStockCheck: Date | null;
          lastPriceCheck: Date | null;
        }) => ({
          provider_id: ip.providerId,
          provider_name: ip.provider.name,
          provider_rut: ip.provider.rut,
          current_price: ip.currentPrice ? Number(ip.currentPrice) : null,
          last_stock_check: ip.lastStockCheck ? ip.lastStockCheck.toISOString() : null,
          last_price_check: ip.lastPriceCheck ? ip.lastPriceCheck.toISOString() : null,
          accounts: ip.provider.accounts.map((a: { accountIdentifier: string }) => a.accountIdentifier),
        })
      );

      return {
        item_id: item.id,
        name: item.name,
        description: item.description,
        current_stock: item.currentStock,
        category: {
          id: item.categoryId,
          name: item.category?.name ?? null,
        },
        allergy_type: {
          type: root ? { id: root.id, name: root.name } : undefined,
          category: category ? { id: category.id, name: category.name } : undefined,
          subtype: subtype ? { id: subtype.id, name: subtype.name } : undefined,
        },
        providers,
      };
    }
  );

  // Sort in JS: root.name, parent.name, subtype.name, item.name
  overview.sort(
    (
      a: {
        allergy_type: { type?: { name: string }; category?: { name: string }; subtype?: { name: string } };
        name: string;
      },
      b: {
        allergy_type: { type?: { name: string }; category?: { name: string }; subtype?: { name: string } };
        name: string;
      }
    ) => {
      const rootA = a.allergy_type.type?.name || "";
      const rootB = b.allergy_type.type?.name || "";
      if (rootA !== rootB) return rootA.localeCompare(rootB);

      const catA = a.allergy_type.category?.name || "";
      const catB = b.allergy_type.category?.name || "";
      if (catA !== catB) return catA.localeCompare(catB);

      const subA = a.allergy_type.subtype?.name || "";
      const subB = b.allergy_type.subtype?.name || "";
      if (subA !== subB) return subA.localeCompare(subB);

      return a.name.localeCompare(b.name);
    }
  );

  return overview;
}
