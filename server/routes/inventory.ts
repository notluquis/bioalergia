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
} from "../repositories/inventory.js";
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
      res.json({ status: "ok", data: categories });
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
      res.status(201).json({ status: "ok", data: category });
    })
  );

  // Item Routes
  router.get(
    "/items",
    asyncHandler(async (_req, res) => {
      const items = await listInventoryItems();
      res.json({ status: "ok", data: items });
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
      const item = await createInventoryItem({ ...data, description: data.description ?? null });
      res.status(201).json({ status: "ok", data: item });
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
      const item = await updateInventoryItem(id, parsed.data);
      res.json({ status: "ok", data: item });
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
      await createInventoryMovement(parsed.data);
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
