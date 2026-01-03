import express from "express";

import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import {
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
} from "../schemas/index.js";
import {
  createInventoryCategory,
  createInventoryItem,
  createInventoryMovement,
  deleteInventoryCategory,
  deleteInventoryItem,
  listInventoryCategories,
  listInventoryItems,
  updateInventoryItem,
} from "../services/inventory.js";

export function registerInventoryRoutes(app: express.Express) {
  const router = express.Router();

  // Category Routes

  // GET /api/inventory/allergy-overview - Specialized view for allergy inventory
  router.get(
    "/allergy-overview",
    authorize("read", "InventoryItem"),
    asyncHandler(async (_req, res) => {
      // Fetch all items with their categories
      const items = await listInventoryItems();

      // Transform into the expected frontend shape (AllergyInventoryOverview)
      // Since we don't have explicit "AllergyType" or "Provider" tables yet, we'll map existing data.
      // We'll treat all items as belonging to a "General" type for now, or group by some logic if needed.

      const mappedData = items.map((item) => ({
        item_id: item.id,
        name: item.name,
        description: item.description,
        current_stock: item.currentStock,
        allergy_type: {
          type: {
            id: 1,
            name: "Insumos Generales", // Placeholder Type
            slug: "general",
            description: null,
          },
          category: {
            id: item.categoryId ?? 0,
            name: item.category?.name ?? "Sin categoría",
            description: null,
          },
        },
        providers: [], // We don't have providers linked to items in the schema yet
      }));

      res.json({
        status: "ok",
        data: mappedData,
      });
    })
  );

  router.get(
    "/categories",
    authorize("read", "InventoryItem"),
    asyncHandler(async (_req, res) => {
      const categories = await listInventoryCategories();
      res.json({
        status: "ok",
        data: categories.map((c: { id: number; name: string; createdAt: Date }) => ({
          id: c.id,
          name: c.name,
          created_at: c.createdAt.toISOString(),
        })),
      });
    })
  );

  router.post(
    "/categories",
    authorize("update", "InventoryItem"),
    asyncHandler(async (req, res) => {
      const parsed = inventoryCategorySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Invalid data", issues: parsed.error.issues });
      }
      const category = await createInventoryCategory(parsed.data.name);
      res.status(201).json({
        status: "ok",
        data: {
          id: category.id,
          name: category.name,
          created_at: category.createdAt.toISOString(),
        },
      });
    })
  );

  // Delete Category
  router.delete(
    "/categories/:id",
    authorize("update", "InventoryItem"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      try {
        await deleteInventoryCategory(id);
        res.status(204).send();
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes("associated items")) {
          res.status(409).json({ status: "error", message: err.message });
        } else {
          throw err;
        }
      }
    })
  );

  // Item Routes
  router.get(
    "/items",
    authorize("read", "InventoryItem"),
    asyncHandler(async (_req, res) => {
      const items = await listInventoryItems();
      res.json({
        status: "ok",
        data: items.map(
          (i: {
            id: number;
            categoryId: number | null;
            name: string;
            description: string | null;
            currentStock: number;
            createdAt: Date;
            updatedAt: Date;
            category_name?: string | null;
          }) => ({
            id: i.id,
            category_id: i.categoryId,
            name: i.name,
            description: i.description,
            current_stock: i.currentStock,
            created_at: i.createdAt.toISOString(),
            updated_at: i.updatedAt.toISOString(),
            category_name: i.category_name,
          })
        ),
      });
    })
  );

  router.post(
    "/items",
    authorize("update", "InventoryItem"),
    asyncHandler(async (req, res) => {
      const parsed = inventoryItemSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Invalid data", issues: parsed.error.issues });
      }
      const data = parsed.data;
      const item = await createInventoryItem({
        name: data.name,
        description: data.description ?? null,
        currentStock: data.current_stock,
        categoryId: data.category_id ?? null,
      });
      res.status(201).json({
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
    })
  );

  router.put(
    "/items/:id",
    authorize("update", "InventoryItem"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const parsed = inventoryItemUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Invalid data", issues: parsed.error.issues });
      }
      const data = parsed.data;
      const item = await updateInventoryItem(id, {
        name: data.name,
        description: data.description,
        currentStock: data.current_stock,
        categoryId: data.category_id,
      });
      res.json({
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
    })
  );

  router.delete(
    "/items/:id",
    authorize("delete", "InventoryItem"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      await deleteInventoryItem(id);
      res.status(204).send();
    })
  );

  router.post(
    "/movements",
    authorize("update", "InventoryItem"),
    asyncHandler(async (req, res) => {
      const parsed = inventoryMovementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Invalid data", issues: parsed.error.issues });
      }
      await createInventoryMovement({
        itemId: parsed.data.item_id,
        quantityChange: parsed.data.quantity_change,
        reason: parsed.data.reason,
      });
      res.status(201).json({ status: "ok" });
    })
  );

  app.use("/api/inventory", authenticate, router);
}
