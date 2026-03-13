import { oc } from "@orpc/contract";
import { z } from "zod";

export const transactionsInsightsStatsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const transactionsInsightsParticipantLeaderboardInputSchema = z.object({
  from: z.string().optional(),
  limit: z.number().int().positive().optional(),
  mode: z.enum(["combined", "incoming", "outgoing"]).optional(),
  to: z.string().optional(),
});

export const transactionsInsightsParticipantInsightInputSchema = z.object({
  from: z.string().optional(),
  id: z.string().min(1),
  to: z.string().optional(),
});

export const transactionsInsightsParticipantLeaderboardItemSchema = z.object({
  count: z.number(),
  personId: z.string(),
  personName: z.string(),
  total: z.number(),
});

export const transactionsInsightsParticipantCounterpartSchema = z.object({
  bankAccountHolder: z.string().nullable(),
  bankAccountNumber: z.string().nullable(),
  bankAccountType: z.string().nullable(),
  bankBranch: z.string().nullable(),
  bankName: z.string().nullable(),
  counterpart: z.string(),
  counterpartId: z.string().nullable(),
  identificationNumber: z.string().nullable(),
  identificationType: z.string().nullable(),
  incomingAmount: z.number(),
  incomingCount: z.number(),
  outgoingAmount: z.number(),
  outgoingCount: z.number(),
  withdrawId: z.string().nullable(),
});

export const transactionsInsightsParticipantMonthlySchema = z.object({
  incomingAmount: z.number(),
  incomingCount: z.number(),
  month: z.string(),
  outgoingAmount: z.number(),
  outgoingCount: z.number(),
});

export const transactionsInsightsMovementTypeSchema = z.object({
  description: z.string().nullable(),
  direction: z.enum(["IN", "NEUTRO", "OUT"]),
  total: z.number(),
});

export const transactionsInsightsParticipantsResponseSchema = z.object({
  data: z.array(transactionsInsightsParticipantLeaderboardItemSchema),
  status: z.literal("ok"),
});

export const transactionsInsightsParticipantInsightResponseSchema = z.object({
  counterparts: z.array(transactionsInsightsParticipantCounterpartSchema),
  monthly: z.array(transactionsInsightsParticipantMonthlySchema),
  participant: z.string(),
  status: z.literal("ok"),
});

export const transactionsInsightsStatsResponseSchema = z.object({
  byType: z.array(transactionsInsightsMovementTypeSchema),
  monthly: z.array(
    z.object({
      in: z.number(),
      month: z.string(),
      net: z.number(),
      out: z.number(),
    }),
  ),
  status: z.literal("ok"),
  totals: z.record(z.string(), z.number()),
});

export const transactionsInsightsContract = {
  participantInsight: oc
    .route({ method: "GET", path: "/participants/{id}" })
    .input(transactionsInsightsParticipantInsightInputSchema)
    .output(transactionsInsightsParticipantInsightResponseSchema),
  participants: oc
    .route({ method: "GET", path: "/participants" })
    .input(transactionsInsightsParticipantLeaderboardInputSchema)
    .output(transactionsInsightsParticipantsResponseSchema),
  stats: oc
    .route({ method: "GET", path: "/stats" })
    .input(transactionsInsightsStatsQuerySchema)
    .output(transactionsInsightsStatsResponseSchema),
};

export type TransactionsInsightsContract = typeof transactionsInsightsContract;
