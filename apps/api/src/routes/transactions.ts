import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { transactionsQuerySchema } from "../lib/financial-schemas";
import { mapTransaction } from "../lib/mappers";
import { listTransactions, type TransactionFilters } from "../services/transactions";
import { reply } from "../utils/reply";

const app = new Hono();

// ============================================================
// SCHEMAS
// ============================================================

// Extend the shared schema to include the API-specific flag
const listTransactionsSchema = transactionsQuerySchema.extend({
  includeTest: z.enum(["true", "false"]).optional(),
});

const participantLeaderboardSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

const participantInsightParamsSchema = z.object({
  id: z.string(),
});

const participantInsightQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

const statsQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

// ============================================================
// ROUTES
// ============================================================

app.get("/", zValidator("query", listTransactionsSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Transaction");
  const canReadList = await hasPermission(user.id, "read", "TransactionList");

  if (!canRead && !canReadList) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const {
    limit: rawLimit,
    includeAmounts: includeAmountsRaw,
    includeTotal: includeTotalRaw,
    page: rawPage,
    pageSize: rawPageSize,
    from,
    to,
    description,
    sourceId,
    externalReference,
    transactionType,
    status,
    search,
    includeTest,
  } = c.req.valid("query");

  const limit = Math.min(rawLimit || 100, 2000);
  const includeAmounts = includeAmountsRaw === "true";
  const includeTotal = includeTotalRaw !== "false";
  const page = rawPage ?? 1;
  const pageSize = rawPageSize ?? limit;
  const offset = (page - 1) * pageSize;

  const filters: TransactionFilters = {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    description,
    sourceId,
    externalReference,
    transactionType,
    status,
    search,
    includeTest: includeTest === "true",
  };

  const { total, transactions } = await listTransactions(filters, pageSize, offset, includeTotal);
  const data = transactions.map(mapTransaction);

  return reply(c, {
    status: "ok",
    data,
    hasAmounts: includeAmounts,
    total,
    page,
    pageSize,
  });
});

app.get("/participants", zValidator("query", participantLeaderboardSchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Transaction");
  const canReadList = await hasPermission(user.id, "read", "TransactionList");

  if (!canRead && !canReadList) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { from, to, limit } = c.req.valid("query");
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  const { getParticipantLeaderboard } = await import("../services/transactions");
  try {
    const result = await getParticipantLeaderboard({ from: fromDate, to: toDate, limit });
    return reply(c, result);
  } catch (err) {
    console.error("Error fetching participant leaderboard:", err);
    return reply(c, { status: "error", message: "Error interno" }, 500);
  }
});

app.get(
  "/participants/:id",
  zValidator("param", participantInsightParamsSchema),
  zValidator("query", participantInsightQuerySchema),
  async (c) => {
    const user = await getSessionUser(c);
    if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

    const canRead = await hasPermission(user.id, "read", "Transaction");
    const canReadList = await hasPermission(user.id, "read", "TransactionList");

    if (!canRead && !canReadList) {
      return reply(c, { status: "error", message: "Forbidden" }, 403);
    }

    const { id } = c.req.valid("param");
    const { from, to } = c.req.valid("query");
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    const { getParticipantInsight } = await import("../services/transactions");

    try {
      const result = await getParticipantInsight(id, { from: fromDate, to: toDate });
      return reply(c, result);
    } catch (err) {
      console.error("Error fetching participant insight:", err);
      return reply(c, { status: "error", message: "Error interno" }, 500);
    }
  },
);

app.get("/stats", zValidator("query", statsQuerySchema), async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Transaction");
  const canReadStats = await hasPermission(user.id, "read", "TransactionStats");

  if (!canRead && !canReadStats) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const { from, to } = c.req.valid("query");
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const { getTransactionStats } = await import("../services/transactions");

  try {
    const result = await getTransactionStats({ from: fromDate, to: toDate });
    return reply(c, result);
  } catch (err) {
    console.error("Error fetching stats:", err);
    return reply(c, { status: "error", message: "Error interno" }, 500);
  }
});

export default app;
