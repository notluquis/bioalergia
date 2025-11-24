import express from "express";
import { asyncHandler, authenticate } from "../lib/index.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { normalizeTimestamp, normalizeTimestampString, parseDateOnly } from "../lib/time.js";

function clampLimit(value: unknown) {
  const num = Number(value ?? 500);
  if (!Number.isFinite(num) || num <= 0) return 500;
  return Math.min(Math.floor(num), 2000);
}
import { transactionsQuerySchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";
import { listTransactions, type TransactionFilters } from "../services/transactions.js";
import {
  getTransactionStats,
  getParticipantLeaderboard,
  getParticipantInsight,
} from "../services/transaction-stats.js";

export function registerTransactionRoutes(app: express.Express) {
  app.get(
    "/api/transactions",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = transactionsQuerySchema.parse(req.query);
      const limit = clampLimit(parsed.limit);
      const includeAmounts = parsed.includeAmounts === "true";

      const page = parsed.page ?? 1;
      const pageSize = parsed.pageSize ?? limit;
      const offset = (page - 1) * pageSize;

      logEvent(
        "transactions/list",
        requestContext(req, {
          limit,
          includeAmounts,
          filters: parsed,
          page,
          pageSize,
        })
      );

      const filters: TransactionFilters = {
        from: parsed.from ? (parseDateOnly(parsed.from) ?? undefined) : undefined,
        to: parsed.to ? (parseDateOnly(parsed.to) ?? undefined) : undefined,
        description: parsed.description,
        origin: parsed.origin,
        destination: parsed.destination,
        sourceId: parsed.sourceId,
        bankAccountNumber: parsed.bankAccountNumber,
        direction: parsed.direction,
        search: parsed.search,
      };

      const { total, transactions } = await listTransactions(filters, pageSize, offset);

      const data = transactions.map((row) => {
        const payout = row.payout
          ? {
              withdrawId: String(row.payout.withdrawId),
              dateCreated:
                normalizeTimestampString(row.payout.dateCreated ? row.payout.dateCreated.toISOString() : null) || null,
              status: (row.payout.status as string) ?? null,
              statusDetail: (row.payout.statusDetail as string) ?? null,
              amount: row.payout.amount != null ? Number(row.payout.amount) : null,
              fee: row.payout.fee != null ? Number(row.payout.fee) : null,
              payoutDesc: (row.payout.payoutDesc as string) ?? null,
              bankAccountHolder: (row.payout.bankAccountHolder as string) ?? null,
              bankName: (row.payout.bankName as string) ?? null,
              bankAccountType: (row.payout.bankAccountType as string) ?? null,
              bankAccountNumber: (row.payout.bankAccountNumber as string) ?? null,
              bankBranch: (row.payout.bankBranch as string) ?? null,
              identificationType: (row.payout.identificationType as string) ?? null,
              identificationNumber: (row.payout.identificationNumber as string) ?? null,
            }
          : null;

        const originalDestination = (row.destination as string) ?? null;
        const destination =
          (row.direction as string) === "OUT" && payout?.bankAccountHolder
            ? `${payout.bankAccountHolder}${payout.bankName ? ` · ${payout.bankName}` : ""}`
            : originalDestination;

        const loanSchedule = row.loanSchedule
          ? {
              id: Number(row.loanSchedule.id),
              installmentNumber: Number(row.loanSchedule.installmentNumber ?? 0),
              status: (row.loanSchedule.status as string) ?? "PENDING",
              dueDate: row.loanSchedule.dueDate ? row.loanSchedule.dueDate.toISOString().slice(0, 10) : null,
              expectedAmount: row.loanSchedule.expectedAmount != null ? Number(row.loanSchedule.expectedAmount) : null,
              loanTitle: row.loanSchedule.loan?.title != null ? String(row.loanSchedule.loan.title) : null,
              loanPublicId: row.loanSchedule.loan?.publicId != null ? String(row.loanSchedule.loan.publicId) : null,
            }
          : null;

        const serviceSchedule = row.serviceSchedule
          ? {
              id: Number(row.serviceSchedule.id),
              status: (row.serviceSchedule.status as string) ?? "PENDING",
              dueDate: row.serviceSchedule.dueDate ? row.serviceSchedule.dueDate.toISOString().slice(0, 10) : null,
              expectedAmount:
                row.serviceSchedule.expectedAmount != null ? Number(row.serviceSchedule.expectedAmount) : null,
              serviceName: row.serviceSchedule.service?.name != null ? String(row.serviceSchedule.service.name) : null,
              servicePublicId:
                row.serviceSchedule.service?.publicId != null ? String(row.serviceSchedule.service.publicId) : null,
              periodStart: row.serviceSchedule.periodStart
                ? row.serviceSchedule.periodStart.toISOString().slice(0, 10)
                : null,
            }
          : null;

        return {
          id: Number(row.id),
          timestamp: normalizeTimestamp(row.timestamp, row.timestampRaw),
          timestamp_raw: (row.timestampRaw as string) ?? null,
          description: (row.description as string) ?? payout?.payoutDesc ?? null,
          origin: (row.origin as string) ?? null,
          destination,
          source_id: (row.sourceId as string) ?? null,
          direction: row.direction as "IN" | "OUT" | "NEUTRO",
          amount: row.amount != null ? Number(row.amount) : null,
          created_at: row.createdAt.toISOString(),
          payout,
          loanSchedule,
          serviceSchedule,
        };
      });

      res.json({ status: "ok", data, hasAmounts: includeAmounts, total, page, pageSize });
    })
  );

  // Transaction statistics endpoint
  app.get(
    "/api/transactions/stats",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { from, to } = req.query;

      logEvent("transactions/stats", requestContext(req, { from, to }));

      const stats = await getTransactionStats({
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
      });

      res.json({ status: "ok", ...stats });
    })
  );

  // Participants leaderboard endpoint
  app.get(
    "/api/transactions/participants",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { from, to, limit, mode } = req.query;

      logEvent("transactions/participants", requestContext(req, { from, to, limit, mode }));

      const participants = await getParticipantLeaderboard({
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
        limit: typeof limit === "string" ? parseInt(limit, 10) : undefined,
        mode:
          typeof mode === "string" && ["combined", "incoming", "outgoing"].includes(mode)
            ? (mode as "combined" | "incoming" | "outgoing")
            : undefined,
      });

      res.json({ status: "ok", data: participants });
    })
  );

  // Participant detail endpoint
  app.get(
    "/api/transactions/participants/:id",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const participantId = req.params.id;
      const { from, to } = req.query;

      logEvent("transactions/participant-detail", requestContext(req, { participantId, from, to }));

      const insight = await getParticipantInsight(participantId, {
        from: typeof from === "string" ? from : undefined,
        to: typeof to === "string" ? to : undefined,
      });

      res.json({ status: "ok", ...insight });
    })
  );
}
