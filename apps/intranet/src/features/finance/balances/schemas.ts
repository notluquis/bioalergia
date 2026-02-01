import { z } from "zod";

export const DailyBalanceDaySchema = z.strictObject({
  date: z.coerce.date(),
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
  from: z.coerce.date(),
  previous: z
    .strictObject({
      balance: z.number(),
      date: z.coerce.date(),
      note: z.string().nullable(),
    })
    .nullable(),
  status: z.literal("ok"),
  to: z.coerce.date(),
});

export const StatusResponseSchema = z.strictObject({ status: z.literal("ok") });
