import { oc } from "@orpc/contract";
import { z } from "zod";

// ─── Essbio ───────────────────────────────────────────────────────────────────

export const essbioBillResultSchema = z.object({
  accountNumber: z.string(),
  address: z.string(),
  clientName: z.string(),
  company: z.string(),
  currentDebt: z.number(),
  error: z.string().nullable(),
  lastPayment: z.object({ amount: z.number(), date: z.string() }).nullable(),
  observation: z.string().nullable(),
  previousBalance: z.number(),
  regulated: z.boolean(),
});

export const fetchEssbioBillInputSchema = z.object({
  serviceNumber: z.string().min(1),
});

export const fetchEssbioBillResponseSchema = z.object({
  bill: essbioBillResultSchema,
  status: z.literal("ok"),
});

// ─── CGE ─────────────────────────────────────────────────────────────────────

export const cgeBillResultSchema = z.object({
  accountNumber: z.string(),
  address: z.string(),
  clientName: z.string(),
  commune: z.string(),
  company: z.string(),
  currentBill: z.number(),
  emissionDate: z.string(),
  previousBill: z.number(),
  thirdBill: z.number(),
});

export const fetchCgeBillInputSchema = z.object({
  accountNumber: z.string().min(1),
});

export const fetchCgeBillResponseSchema = z.object({
  bill: cgeBillResultSchema,
  status: z.literal("ok"),
});

// ─── Contract ─────────────────────────────────────────────────────────────────

export const utilityBillsContract = {
  fetchCge: oc
    .route({ method: "POST", path: "/cge" })
    .input(fetchCgeBillInputSchema)
    .output(fetchCgeBillResponseSchema),

  fetchEssbio: oc
    .route({ method: "POST", path: "/essbio" })
    .input(fetchEssbioBillInputSchema)
    .output(fetchEssbioBillResponseSchema),
};

export type UtilityBillsContract = typeof utilityBillsContract;
