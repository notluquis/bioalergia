import { Hono } from "hono";
import { getSessionUser } from "../auth";
import { listTransactions, TransactionFilters } from "../services/transactions";
import { transactionsQuerySchema } from "../lib/financial-schemas";
import { mapTransaction } from "../lib/mappers";

const app = new Hono();

app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

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

export default app;
