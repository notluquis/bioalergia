import { z } from "zod";

const MonthlyFlowSchema = z.strictObject({
  in: z.number(),
  month: z.string(),
  net: z.number(),
  out: z.number(),
});

const MovementTypeSchema = z.strictObject({
  description: z.string().nullable(),
  direction: z.enum(["IN", "NEUTRO", "OUT"]),
  total: z.number(),
});

export const StatsResponseSchema = z.strictObject({
  byType: z.array(MovementTypeSchema),
  monthly: z.array(MonthlyFlowSchema),
  status: z.literal("ok"),
  totals: z.record(z.string(), z.number()),
});

export const TopParticipantsResponseSchema = z.strictObject({
  data: z.array(
    z.strictObject({
      bankAccountNumber: z.string().nullable().optional(),
      count: z.number(),
      identificationNumber: z.string().nullable().optional(),
      personId: z.string(),
      personName: z.string(),
      total: z.number(),
    })
  ),
  status: z.literal("ok"),
});
