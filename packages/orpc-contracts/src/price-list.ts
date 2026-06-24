import { oc } from "@orpc/contract";
import { z } from "zod";

// ── Lista de precios pública (prestaciones / insumos) ────────────────
export const priceListItemSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  category: z.string(),
  unit: z.string(),
  priceClp: z.number().int(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const priceListResponseSchema = z.object({
  items: z.array(priceListItemSchema),
});

export const upsertPriceListItemInputSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1).optional(),
  name: z.string().min(1),
  category: z.string().min(1),
  unit: z.string().min(1).default("unidad"),
  priceClp: z.number().int().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

export const priceListItemIdInputSchema = z.object({ id: z.string().min(1) });

export const priceListStatusResponseSchema = z.object({
  status: z.string(),
});

export const priceListContract = {
  list: oc.route({ method: "GET", path: "/items" }).output(priceListResponseSchema),
  upsert: oc
    .route({ method: "POST", path: "/items" })
    .input(upsertPriceListItemInputSchema)
    .output(priceListItemSchema),
  remove: oc
    .route({ method: "DELETE", path: "/items" })
    .input(priceListItemIdInputSchema)
    .output(priceListStatusResponseSchema),
};

export type PriceListContract = typeof priceListContract;
export type PriceListItemDto = z.infer<typeof priceListItemSchema>;
export type UpsertPriceListItemInput = z.infer<typeof upsertPriceListItemInputSchema>;
