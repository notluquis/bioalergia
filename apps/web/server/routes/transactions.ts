import express from "express";

import { asyncHandler, authenticate } from "../lib/index.js";
import { logEvent, requestContext } from "../lib/logger.js";
import { mapTransaction } from "../lib/mappers.js";
import { coerceLimit } from "../lib/query-helpers.js";
import { parseDateOnly } from "../lib/time.js";
import { authorize } from "../middleware/authorize.js";
import { transactionsQuerySchema } from "../schemas/index.js";
import { listTransactions, type TransactionFilters } from "../services/transactions.js";
import type { AuthenticatedRequest } from "../types.js";

export function registerTransactionRoutes(app: express.Express) {
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
        sourceId: parsed.sourceId,
        externalReference: parsed.externalReference,
        transactionType: parsed.transactionType,
        status: parsed.status,
        search: parsed.search,
      };

      const { total, transactions } = await listTransactions(filters, pageSize, offset, req.ability);

      const data = transactions.map(mapTransaction);

      res.json({ status: "ok", data, hasAmounts: includeAmounts, total, page, pageSize });
    })
  );
}
