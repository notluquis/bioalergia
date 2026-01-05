import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { listTransactions, TransactionFilters } from "../services/transactions";
import { transactionsQuerySchema } from "../lib/financial-schemas";
import { mapTransaction } from "../lib/mappers";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Transaction");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const query = c.req.query();
  const parsed = transactionsQuerySchema.safeParse(query);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Filtros inválidos",
        issues: parsed.error.issues,
      },
      400
    );
  }

  const limit = Math.min(parsed.data.limit || 100, 2000);
  const includeAmounts = parsed.data.includeAmounts === "true";
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? limit;
  const offset = (page - 1) * pageSize;

  const filters: TransactionFilters = {
    from: parsed.data.from ? new Date(parsed.data.from) : undefined,
    to: parsed.data.to ? new Date(parsed.data.to) : undefined,
    description: parsed.data.description,
    sourceId: parsed.data.sourceId,
    externalReference: parsed.data.externalReference,
    transactionType: parsed.data.transactionType,
    status: parsed.data.status,
    search: parsed.data.search,
  };

  const { total, transactions } = await listTransactions(
    filters,
    pageSize,
    offset
  );
  const data = transactions.map(mapTransaction);

  return c.json({
    status: "ok",
    data,
    hasAmounts: includeAmounts,
    total,
    page,
    pageSize,
  });
});

app.get("/participants", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Transaction");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const query = c.req.query();
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  const limit = query.limit ? Number(query.limit) : undefined;

  const { getParticipantLeaderboard } =
    await import("../services/transactions");
  try {
    const result = await getParticipantLeaderboard({ from, to, limit });
    return c.json(result);
  } catch (err) {
    console.error("Error fetching participant leaderboard:", err);
    return c.json({ status: "error", message: "Error interno" }, 500);
  }
});

app.get("/participants/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Transaction");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = c.req.param("id");
  const query = c.req.query();
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;

  const { getParticipantInsight } = await import("../services/transactions");

  try {
    const result = await getParticipantInsight(id, { from, to });
    return c.json(result);
  } catch (err) {
    console.error("Error fetching participant insight:", err);
    return c.json({ status: "error", message: "Error interno" }, 500);
  }
});

app.get("/stats", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const query = c.req.query();
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;

  if (!from || !to) {
    return c.json({ status: "error", message: "Fechas requeridas" }, 400);
  }

  const { getTransactionStats } = await import("../services/transactions");

  try {
    const result = await getTransactionStats({ from, to });
    return c.json(result);
  } catch (err) {
    console.error("Error fetching stats:", err);
    return c.json({ status: "error", message: "Error interno" }, 500);
  }
});

export default app;
