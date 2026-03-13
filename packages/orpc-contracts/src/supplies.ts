import { oc } from "@orpc/contract";
import { z } from "zod";

export const supplyStatusSchema = z.enum(["pending", "ordered", "in_transit", "delivered", "rejected"]);

export const commonSupplySchema = z.object({
  brand: z.string().optional(),
  description: z.string().optional(),
  id: z.number().int(),
  model: z.string().optional(),
  name: z.string(),
});

export const supplyRequestResponseSchema = z.object({
  admin_notes: z.string().optional(),
  brand: z.string().optional(),
  created_at: z.coerce.date(),
  id: z.number().int(),
  model: z.string().optional(),
  notes: z.string().optional(),
  quantity: z.number().int(),
  status: supplyStatusSchema,
  supply_name: z.string(),
  user_email: z.string().optional(),
});

export const createSupplyRequestSchema = z.object({
  brand: z.string().optional(),
  model: z.string().optional(),
  notes: z.string().optional(),
  quantity: z.number().int().positive(),
  supplyName: z.string().min(1),
});

export const updateSupplyRequestStatusInputSchema = z.object({
  id: z.number().int().positive(),
  status: supplyStatusSchema,
});

export const commonSuppliesResponseSchema = z.object({
  commonSupplies: z.array(commonSupplySchema),
});

export const supplyRequestsResponseSchema = z.object({
  requests: z.array(supplyRequestResponseSchema),
});

export const suppliesStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const suppliesContract = {
  common: oc.route({ method: "GET", path: "/common" }).output(commonSuppliesResponseSchema),
  createRequest: oc
    .route({ method: "POST", path: "/requests" })
    .input(createSupplyRequestSchema)
    .output(suppliesStatusResponseSchema),
  requests: oc.route({ method: "GET", path: "/requests" }).output(supplyRequestsResponseSchema),
  updateRequestStatus: oc
    .route({ method: "PUT", path: "/requests/{id}/status" })
    .input(updateSupplyRequestStatusInputSchema)
    .output(suppliesStatusResponseSchema),
};

export type SuppliesContract = typeof suppliesContract;
