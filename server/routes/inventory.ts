import express from "express";
import { asyncHandler, authenticate } from "../lib/http.js";
import {
  createInventoryCategory,
  listInventoryCategories,
  listInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  createInventoryMovement,
  listAllergyInventoryOverview,
} from "../services/inventory.js";
import {
  inventoryCategorySchema,
  inventoryItemSchema,
  inventoryItemUpdateSchema,
  inventoryMovementSchema,
} from "../schemas.js";

export function registerInventoryRoutes(app: express.Express) {
  const router = express.Router();

  // Category Routes
  router.get(
    "/categories",
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

  // Item Routes
  router.get(
    "/items",
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
        category: data.category_id ? { connect: { id: data.category_id } } : undefined,
      });
      res.status(201).json({
        status: "ok",
        data: {
          id: item.id,
          category_id: item.categoryId,
          name: item.name,
          description: item.description,
          current_stock: item.currentStock,
          created_at: item.createdAt.toISOString(),
          updated_at: item.updatedAt.toISOString(),
          category_name: item.category?.name,
        },
      });
    })
  );

  router.put(
    "/items/:id",
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
        category:
          data.category_id !== undefined
            ? data.category_id
              ? { connect: { id: data.category_id } }
              : { disconnect: true }
            : undefined,
      });
      res.json({
        status: "ok",
        data: {
          id: item.id,
          category_id: item.categoryId,
          name: item.name,
          description: item.description,
          current_stock: item.currentStock,
          created_at: item.createdAt.toISOString(),
          updated_at: item.updatedAt.toISOString(),
          category_name: item.category?.name,
        },
      });
    })
  );

  router.delete(
    "/items/:id",
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      await deleteInventoryItem(id);
      res.status(204).send();
    })
  );

  // Movement Routes
  router.post(
    "/movements",
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

  router.get(
    "/allergy-overview",
    asyncHandler(async (_req, res) => {
      const overview = await listAllergyInventoryOverview();
      res.json({ status: "ok", data: overview });
    })
  );

  app.use("/api/inventory", authenticate, router);
}
