import { Hono } from "hono";
import { z } from "zod";
import type { AuthSession } from "../auth";
import { hasPermission } from "../auth";
import { AppError } from "../lib/app-error";
import { transactionsQuerySchema } from "../lib/financial-schemas";
import { requireSession } from "../lib/legacy-route";
import { mapTransaction } from "../lib/mappers";
import { zValidator } from "../lib/zod-validator";
import { listTransactions, type TransactionFilters } from "../services/transactions";
import { reply } from "../utils/reply";

const app = new Hono<{
  Variables: {
    user: AuthSession;
  };
}>();

app.use("*", requireSession);

async function requireTransactionReadAccess(userId: number) {
  const canRead = await hasPermission(userId, "read", "Transaction");
  const canReadList = await hasPermission(userId, "read", "TransactionList");

  if (!canRead && !canReadList) {
    throw new AppError(403, {
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  }
}

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

const parseDateStart = (value: string) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseDateEnd = (value: string) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

// ============================================================
// ROUTES
// ============================================================

app.get("/", zValidator("query", listTransactionsSchema), async (c) => {
  const user = c.get("user");
  await requireTransactionReadAccess(user.id);

  const {
    limit: rawLimit,
    includeAmounts: includeAmountsRaw,
    includeTotal: includeTotalRaw,
    page: rawPage,
    pageSize: rawPageSize,
    from,
    to,
    bankAccountNumber,
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
    from: from ? parseDateStart(from) : undefined,
    to: to ? parseDateEnd(to) : undefined,
    bankAccountNumber: bankAccountNumber?.trim() || undefined,
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
  const user = c.get("user");
  await requireTransactionReadAccess(user.id);

  const { from, to, limit } = c.req.valid("query");
  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;

  const { getParticipantLeaderboard } = await import("../services/transactions");
  try {
    const result = await getParticipantLeaderboard({ from: fromDate, to: toDate, limit });
    return reply(c, result);
  } catch (err) {
    console.error("Error fetching participant leaderboard:", err);
    throw new AppError(500, {
      code: "TRANSACTION_PARTICIPANTS_FAILED",
      expose: false,
      message: "Error interno",
    });
  }
});

app.get(
  "/participants/:id",
  zValidator("param", participantInsightParamsSchema),
  zValidator("query", participantInsightQuerySchema),
  async (c) => {
    const user = c.get("user");
    await requireTransactionReadAccess(user.id);

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
      throw new AppError(500, {
        code: "TRANSACTION_PARTICIPANT_INSIGHT_FAILED",
        expose: false,
        message: "Error interno",
      });
    }
  },
);

app.get("/stats", zValidator("query", statsQuerySchema), async (c) => {
  const user = c.get("user");

  const canRead = await hasPermission(user.id, "read", "Transaction");
  const canReadStats = await hasPermission(user.id, "read", "TransactionStats");

  if (!canRead && !canReadStats) {
    throw new AppError(403, {
      code: "FORBIDDEN",
      message: "Forbidden",
    });
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
    throw new AppError(500, {
      code: "TRANSACTION_STATS_FAILED",
      expose: false,
      message: "Error interno",
    });
  }
});

export const transactionRoutes = app;
