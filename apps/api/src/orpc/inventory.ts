import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { inventoryContract } from "@finanzas/orpc-contracts/inventory";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import {
  createInventoryCategory,
  createInventoryItem,
  createInventoryMovement,
  deleteInventoryCategory,
  deleteInventoryItem,
  listInventoryCategories,
  listInventoryItems,
  updateInventoryItem,
} from "../services/inventory";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();

type InventoryORPCContext = {
  hono: HonoContext;
};

const base = os.$context<InventoryORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const requireReadInventory = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "InventoryItem");
  const canReadSettings = await hasPermission(context.user.id, "update", "InventorySetting");

  if (!canRead && !canReadSettings) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const requireWriteInventory = authed.use(async ({ context, next }) => {
  const canModify =
    (await hasPermission(context.user.id, "create", "InventoryItem")) ||
    (await hasPermission(context.user.id, "update", "InventoryItem")) ||
    (await hasPermission(context.user.id, "delete", "InventoryItem")) ||
    (await hasPermission(context.user.id, "update", "InventorySetting"));

  if (!canModify) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const requireManageInventorySettings = authed.use(async ({ context, next }) => {
  const canManageSettings = await hasPermission(context.user.id, "update", "InventorySetting");

  if (!canManageSettings) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const listAllergyOverviewRoute = requireReadInventory
  .route(inventoryContract.allergyOverview)
  .handler(async () => {
    const items = await listInventoryItems();

    return {
      data: items.map((item) => ({
        item_id: item.id,
        name: item.name,
        description: item.description,
        current_stock: item.currentStock,
        allergy_type: {
          type: {
            id: 1,
            name: "Insumos Generales",
            slug: "general",
            description: null,
          },
          category: {
            id: item.categoryId ?? 0,
            name: item.category?.name ?? "Sin categoría",
            description: null,
          },
        },
        providers: [],
      })),
      status: "ok" as const,
    };
  });

const listCategoriesRoute = requireReadInventory
  .route(inventoryContract.listCategories)
  .handler(async () => {
    const categories = await listInventoryCategories();
    return {
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        created_at: category.createdAt,
      })),
      status: "ok" as const,
    };
  });

const createCategoryRoute = requireManageInventorySettings
  .route(inventoryContract.createCategory)
  .handler(async ({ input }) => {
    const category = await createInventoryCategory(input.name);
    return {
      data: {
        id: category.id,
        name: category.name,
        created_at: category.createdAt,
      },
      status: "ok" as const,
    };
  });

const deleteCategoryRoute = requireManageInventorySettings
  .route(inventoryContract.deleteCategory)
  .handler(async ({ input }) => {
    await deleteInventoryCategory(input.id);
    return { status: "ok" as const };
  });

const listItemsRoute = requireReadInventory
  .route(inventoryContract.listItems)
  .handler(async () => {
    const items = await listInventoryItems();
    return {
      data: items.map((item) => ({
        id: item.id,
        category_id: item.categoryId,
        name: item.name,
        description: item.description,
        current_stock: item.currentStock,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        category_name: item.category_name ?? item.category?.name ?? null,
      })),
      status: "ok" as const,
    };
  });

const createItemRoute = requireWriteInventory
  .route(inventoryContract.createItem)
  .handler(async ({ input }) => {
    const item = await createInventoryItem({
      name: input.name,
      description: input.description ?? null,
      currentStock: input.current_stock,
      categoryId: input.category_id ?? null,
    });

    return {
      data: {
        id: item.id,
        category_id: item.categoryId,
        name: item.name,
        description: item.description,
        current_stock: item.currentStock,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        category_name: item.category?.name ?? null,
      },
      status: "ok" as const,
    };
  });

const updateItemRoute = requireWriteInventory
  .route(inventoryContract.updateItem)
  .handler(async ({ input }) => {
    const item = await updateInventoryItem(input.id, {
      name: input.item.name,
      description: input.item.description,
      currentStock: input.item.current_stock,
      categoryId: input.item.category_id,
    });

    return {
      data: {
        id: item.id,
        category_id: item.categoryId,
        name: item.name,
        description: item.description,
        current_stock: item.currentStock,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        category_name: item.category?.name ?? null,
      },
      status: "ok" as const,
    };
  });

const deleteItemRoute = requireWriteInventory
  .route(inventoryContract.deleteItem)
  .handler(async ({ input }) => {
    await deleteInventoryItem(input.id);
    return { status: "ok" as const };
  });

const createMovementRoute = requireWriteInventory
  .route(inventoryContract.createMovement)
  .handler(async ({ input }) => {
    await createInventoryMovement({
      itemId: input.item_id,
      quantityChange: input.quantity_change,
      reason: input.reason,
    });

    return { status: "ok" as const };
  });

const inventoryORPCRouterBase = {
  allergyOverview: listAllergyOverviewRoute,
  createCategory: createCategoryRoute,
  createItem: createItemRoute,
  createMovement: createMovementRoute,
  deleteCategory: deleteCategoryRoute,
  deleteItem: deleteItemRoute,
  listCategories: listCategoriesRoute,
  listItems: listItemsRoute,
  updateItem: updateItemRoute,
};

export const inventoryORPCRouter = base
  .prefix("/api/orpc/inventory")
  .tag("Inventory")
  .router(inventoryORPCRouterBase);

export const inventoryORPCHandler = new SuperJSONRPCHandler(inventoryORPCRouter, {
  interceptors: [
    onError((error) => {
      logError("inventory.orpc.rpc", error, {});
    }),
  ],
});

export const inventoryOpenAPIHandler = new OpenAPIHandler(inventoryORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsTitle: "Bioalergia Inventory API Reference",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Inventory API",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError("inventory.orpc.openapi", error, {});
    }),
  ],
});

export type InventoryORPCRouter = typeof inventoryORPCRouter;
