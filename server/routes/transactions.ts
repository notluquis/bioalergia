import express from "express";
import { asyncHandler, authenticate } from "../lib/index.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { parseDateOnly } from "../lib/time.js";

import { mapTransaction } from "../lib/mappers.js";

import { coerceLimit } from "../lib/query-helpers.js";
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
      const limit = coerceLimit(req.query.limit, 500, 2000);
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

      const data = transactions.map(mapTransaction);

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

      res.json({ status: "ok", participants });
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
