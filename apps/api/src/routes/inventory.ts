/**
 * Inventory Routes
 * Migrated from apps/web/server/routes/inventory.ts
 */
import { cacheControl } from "../lib/cache-control";
import { Hono } from "hono";
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
import {
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
} from "../lib/inventory-schemas";
import { getSessionUser, hasPermission } from "../auth";

export const inventoryRoutes = new Hono();

// Middleware to ensure user is authenticated
inventoryRoutes.use("*", async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ status: "error", message: "No autorizado" }, 401);
  }

  // For non-GET requests, check for inventory write permissions
  if (c.req.method !== "GET") {
    const canModify =
      (await hasPermission(user.id, "create", "InventoryItem")) ||
      (await hasPermission(user.id, "update", "InventoryItem")) ||
      (await hasPermission(user.id, "delete", "InventoryItem")) ||
      (await hasPermission(user.id, "update", "InventorySetting"));
    if (!canModify) {
      return c.json({ status: "error", message: "Forbidden" }, 403);
    }
  } else {
    // GET requests require read permission
    const canRead = await hasPermission(user.id, "read", "InventoryItem");
    const canReadSettings = await hasPermission(
      user.id,
      "update",
      "InventorySetting"
    );
    if (!canRead && !canReadSettings) {
      return c.json({ status: "error", message: "Forbidden" }, 403);
    }
  }

  await next();
});

// GET /api/inventory/allergy-overview
inventoryRoutes.get("/allergy-overview", async (c) => {
  const items = await listInventoryItems();

  const mappedData = items.map((item) => ({
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
  }));

  return c.json({ status: "ok", data: mappedData });
});

// GET /api/inventory/categories - Cached 5 mins
inventoryRoutes.get("/categories", cacheControl(300), async (c) => {
  const categories = await listInventoryCategories();
  return c.json({
    status: "ok",
    data: categories.map((c) => ({
      id: c.id,
      name: c.name,
      created_at: c.createdAt.toISOString(),
    })),
  });
});

// POST /api/inventory/categories
inventoryRoutes.post("/categories", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canManageSettings = await hasPermission(
    user.id,
    "update",
    "InventorySetting"
  );
  if (!canManageSettings) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = inventoryCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const category = await createInventoryCategory(parsed.data.name);
  return c.json(
    {
      status: "ok",
      data: {
        id: category.id,
        name: category.name,
        created_at: category.createdAt.toISOString(),
      },
    },
    201
  );
});

// DELETE /api/inventory/categories/:id
inventoryRoutes.delete("/categories/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "No autorizado" }, 401);

  const canManageSettings = await hasPermission(
    user.id,
    "update",
    "InventorySetting"
  );
  if (!canManageSettings) {
    return c.json({ status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  try {
    await deleteInventoryCategory(id);
    return c.body(null, 204);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("associated items")) {
      return c.json({ status: "error", message: err.message }, 409);
    }
    throw err;
  }
});

// GET /api/inventory/items
inventoryRoutes.get("/items", async (c) => {
  const items = await listInventoryItems();
  return c.json({
    status: "ok",
    data: items.map((i) => ({
      id: i.id,
      category_id: i.categoryId,
      name: i.name,
      description: i.description,
      current_stock: i.currentStock,
      created_at: i.createdAt.toISOString(),
      updated_at: i.updatedAt.toISOString(),
      category_name: i.category_name,
    })),
  });
});

// POST /api/inventory/items
inventoryRoutes.post("/items", async (c) => {
  const body = await c.req.json();
  const parsed = inventoryItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const data = parsed.data;
  const item = await createInventoryItem({
    name: data.name,
    description: data.description ?? null,
    currentStock: data.current_stock,
    categoryId: data.category_id ?? null,
  });

  return c.json(
    {
      status: "ok",
      data: {
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        currentStock: item.currentStock,
        created_at: item.createdAt.toISOString(),
        updated_at: item.updatedAt.toISOString(),
        category_name: item.category?.name,
      },
    },
    201
  );
});

// PUT /api/inventory/items/:id
inventoryRoutes.put("/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = inventoryItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const data = parsed.data;
  const item = await updateInventoryItem(id, {
    name: data.name,
    description: data.description,
    currentStock: data.current_stock,
    categoryId: data.category_id,
  });

  return c.json({
    status: "ok",
    data: {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      currentStock: item.currentStock,
      created_at: item.createdAt.toISOString(),
      updated_at: item.updatedAt.toISOString(),
      category_name: item.category?.name,
    },
  });
});

// DELETE /api/inventory/items/:id
inventoryRoutes.delete("/items/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await deleteInventoryItem(id);
  return c.body(null, 204);
});

// POST /api/inventory/movements
inventoryRoutes.post("/movements", async (c) => {
  const body = await c.req.json();
  const parsed = inventoryMovementSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  await createInventoryMovement({
    itemId: parsed.data.item_id,
    quantityChange: parsed.data.quantity_change,
    reason: parsed.data.reason,
  });

  return c.json({ status: "ok" }, 201);
});
