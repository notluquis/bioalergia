import { z } from "zod";
import { zDateString } from "@/lib/api-validate";

export const DailyBalanceDaySchema = z.strictObject({
  date: zDateString,
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
  from: zDateString,
  previous: z
    .strictObject({
      balance: z.number(),
      date: zDateString,
      note: z.string().nullable(),
    })
    .nullable(),
  status: z.literal("ok"),
  to: zDateString,
});

export const StatusResponseSchema = z.strictObject({ status: z.literal("ok") });
