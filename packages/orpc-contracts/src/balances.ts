import { oc } from "@orpc/contract";
import { z } from "zod";

export const balancesQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const balanceUpsertSchema = z.object({
  balance: z.number(),
  date: z.string(),
  note: z.string().nullable().optional(),
});

export const balanceDaySchema = z.object({
  date: z.string(),
  difference: z.number().nullable(),
  expectedBalance: z.number().nullable(),
  hasCashback: z.boolean(),
  netChange: z.number(),
  note: z.string().nullable(),
  recordedBalance: z.number().nullable(),
  totalIn: z.number(),
  totalOut: z.number(),
});

export const balancesResponseSchema = z.object({
  days: z.array(balanceDaySchema),
  from: z.string(),
  previous: z
    .object({
      balance: z.number(),
      date: z.string(),
      note: z.string().nullable(),
    })
    .nullable(),
  status: z.literal("ok"),
  to: z.string(),
});

export const balancesStatusResponseSchema = z.object({
  status: z.literal("ok"),
});

export const balancesContract = {
  list: oc.route({ method: "GET", path: "/" }).input(balancesQuerySchema).output(balancesResponseSchema),
  save: oc.route({ method: "POST", path: "/" }).input(balanceUpsertSchema).output(balancesStatusResponseSchema),
};

export type BalancesContract = typeof balancesContract;
