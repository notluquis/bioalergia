/**
 * Inventory & Supplies schemas
 * Ported from apps/intranet/server/schemas/inventory.ts
 */
import { z } from "zod";

export const inventoryCategorySchema = z.object({
  name: z.string().min(1).max(255),
});

export const inventoryItemSchema = z.object({
  category_id: z.coerce.number().int().positive().nullable(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  current_stock: z.coerce.number().int().default(0),
});

export const inventoryItemUpdateSchema = inventoryItemSchema.partial();

export const inventoryMovementSchema = z.object({
  item_id: z.coerce.number().int().positive(),
  quantity_change: z.coerce.number().int(),
  reason: z.string().min(1).max(255),
});

export const supplyRequestSchema = z.object({
  supplyName: z.string().min(1).max(191),
  quantity: z.coerce.number().int().positive(),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateSupplyRequestStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED"]),
  adminNotes: z.string().max(500).optional().nullable(),
});

export const commonSupplySchema = z.object({
  name: z.string().min(1).max(191),
  brand: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});
