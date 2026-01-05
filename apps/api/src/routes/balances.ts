import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { getBalancesReport, upsertDailyBalance } from "../services/balances";
import {
  balancesQuerySchema,
  balanceUpsertSchema,
} from "../lib/financial-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Balance");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const query = c.req.query();
  const parsed = balancesQuerySchema.safeParse(query);

  if (!parsed.success || !parsed.data.from || !parsed.data.to) {
    return c.json(
      { status: "error", message: "Parameters 'from' and 'to' are required" },
      400
    );
  }

  const report = await getBalancesReport(parsed.data.from, parsed.data.to);
  return c.json(report);
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Balance");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = balanceUpsertSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400
    );
  }

  await upsertDailyBalance(
    parsed.data.date,
    parsed.data.balance,
    parsed.data.note
  );
  return c.json({ status: "ok" });
});

export default app;
