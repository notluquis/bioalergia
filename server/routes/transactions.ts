import express from "express";
import { asyncHandler, authenticate } from "../lib/index.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { parseDateOnly } from "../lib/time.js";

import { mapTransaction } from "../lib/mappers.js";

import { coerceLimit } from "../lib/query-helpers.js";
import { transactionsQuerySchema } from "../schemas/index.js";
import type { AuthenticatedRequest } from "../types.js";
import {
  listTransactions,
  getParticipantLeaderboard,
  getParticipantInsight,
  type TransactionFilters,
} from "../services/transactions.js";

import { authorize } from "../middleware/authorize.js";

// ... (other imports)

export function registerTransactionRoutes(app: express.Express) {
  // Participant leaderboard endpoint
  app.get(
    "/api/transactions/participants",
    authenticate,
    authorize("read", "Transaction"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const from = req.query.from ? parseDateOnly(String(req.query.from)) : undefined;
      const to = req.query.to ? parseDateOnly(String(req.query.to)) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const mode = (req.query.mode as "combined" | "incoming" | "outgoing") || "outgoing";

      logEvent("transactions/participants/leaderboard", requestContext(req, { from, to, limit, mode }));

      const participants = await getParticipantLeaderboard({
        from: from ?? undefined,
        to: to ?? undefined,
        limit: Math.min(limit, 100),
        mode,
      });

      res.json({ status: "ok", participants });
    })
  );

  // Participant insight endpoint
  app.get(
    "/api/transactions/participants/:participantId",
    authenticate,
    authorize("read", "Transaction"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const participantId = decodeURIComponent(req.params.participantId);
      const from = req.query.from ? parseDateOnly(String(req.query.from)) : undefined;
      const to = req.query.to ? parseDateOnly(String(req.query.to)) : undefined;

      logEvent("transactions/participants/insight", requestContext(req, { participantId, from, to }));

      const insight = await getParticipantInsight(participantId, {
        from: from ?? undefined,
        to: to ?? undefined,
      });

      res.json({ status: "ok", participant: participantId, ...insight });
    })
  );

  app.get(
    "/api/transactions",
    authenticate,
    authorize("read", "Transaction"),
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
        direction: parsed.direction,
        search: parsed.search,
      };

      const { total, transactions } = await listTransactions(filters, pageSize, offset, req.ability);

      const data = transactions.map(mapTransaction);

      res.json({ status: "ok", data, hasAmounts: includeAmounts, total, page, pageSize });
    })
  );
}
