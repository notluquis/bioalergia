import { Hono } from "hono";
import { reply } from "../utils/reply";
import { getSessionUser, hasPermission } from "../auth";
import { getBalancesReport, upsertDailyBalance } from "../services/balances";
import {
  balancesQuerySchema,
  balanceUpsertSchema,
} from "../lib/financial-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "DailyBalance");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const query = c.req.query();
  const parsed = balancesQuerySchema.safeParse(query);

  if (!parsed.success || !parsed.data.from || !parsed.data.to) {
    return reply(c, 
      { status: "error", message: "Parameters 'from' and 'to' are required" },
      400,
    );
  }

  const report = await getBalancesReport(parsed.data.from, parsed.data.to);
  return reply(c, report);
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "DailyBalance");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = balanceUpsertSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, 
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  await upsertDailyBalance(
    parsed.data.date,
    parsed.data.balance,
    parsed.data.note,
  );
  return reply(c, { status: "ok" });
});

export default app;
