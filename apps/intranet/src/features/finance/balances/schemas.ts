import { z } from "zod";

export const DailyBalanceDaySchema = z.strictObject({
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

export const BalancesApiResponseSchema = z.strictObject({
  days: z.array(DailyBalanceDaySchema),
  from: z.string(),
  previous: z
    .strictObject({
      balance: z.number(),
      date: z.string(),
      note: z.string().nullable(),
    })
    .nullable(),
  status: z.literal("ok"),
  to: z.string(),
});

export const StatusResponseSchema = z.strictObject({ status: z.literal("ok") });
