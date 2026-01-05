import { Hono } from "hono";
import { getSessionUser } from "../auth";
import {
  createCounterpart,
  getCounterpartById,
  listCounterparts,
  updateCounterpart,
  updateCounterpartAccount,
  upsertCounterpartAccount,
} from "../services/counterparts";
import {
  counterpartPayloadSchema,
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
} from "../lib/entity-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const items = await listCounterparts();
  return c.json({ status: "ok", counterparts: items });
});

app.get("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const result = await getCounterpartById(id);
  if (!result) return c.json({ status: "error", message: "Not found" }, 404);

  return c.json({
    status: "ok",
    counterpart: result.counterpart,
    accounts: result.accounts,
  });
});

app.post("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();
  const parsed = counterpartPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await createCounterpart(parsed.data);
  return c.json({
    status: "ok",
    counterpart: result,
    accounts: result.accounts ?? [],
  });
});

app.put("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const body = await c.req.json();
  const parsed = counterpartPayloadSchema.partial().safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await updateCounterpart(id, parsed.data);
  return c.json({
    status: "ok",
    counterpart: result,
    accounts: result.accounts ?? [],
  });
});

// Accounts Sub-resource

app.post("/:id/accounts", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = counterpartAccountPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await upsertCounterpartAccount(id, {
    accountNumber: parsed.data.accountIdentifier, // Schema uses 'identifier' but logic often uses number
    bankName: parsed.data.bankName,
    accountType: parsed.data.accountType,
  });
  return c.json({ status: "ok", accounts: [result] });
});

app.put("/accounts/:accountId", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const accountId = Number(c.req.param("accountId"));
  const body = await c.req.json();
  const parsed = counterpartAccountUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await updateCounterpartAccount(accountId, parsed.data);
  return c.json(result);
});

export default app;
