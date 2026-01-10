import { Hono } from "hono";
import { reply } from "../utils/reply";
import { getSessionUser, hasPermission } from "../auth";
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
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Counterpart");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const items = await listCounterparts();
  return reply(c, { status: "ok", counterparts: items });
});

app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Counterpart");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return reply(c, { status: "error", message: "Invalid ID" }, 400);

  const result = await getCounterpartById(id);
  if (!result) return reply(c, { status: "error", message: "Not found" }, 404);

  return reply(c, {
    status: "ok",
    counterpart: result.counterpart,
    accounts: result.accounts,
  });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Counterpart");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = counterpartPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, 
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await createCounterpart(parsed.data);
  return reply(c, {
    status: "ok",
    counterpart: result,
    accounts: result.accounts ?? [],
  });
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return reply(c, { status: "error", message: "Invalid ID" }, 400);

  const body = await c.req.json();
  const parsed = counterpartPayloadSchema.partial().safeParse(body);

  if (!parsed.success) {
    return reply(c, 
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await updateCounterpart(id, parsed.data);
  return reply(c, {
    status: "ok",
    counterpart: result,
    accounts: result.accounts ?? [],
  });
});

// Accounts Sub-resource

app.post("/:id/accounts", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = counterpartAccountPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, 
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await upsertCounterpartAccount(id, {
    accountNumber: parsed.data.accountIdentifier, // Schema uses 'identifier' but logic often uses number
    bankName: parsed.data.bankName,
    accountType: parsed.data.accountType,
  });
  return reply(c, { status: "ok", accounts: [result] });
});

app.put("/accounts/:accountId", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const accountId = Number(c.req.param("accountId"));
  const body = await c.req.json();
  const parsed = counterpartAccountUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, 
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await updateCounterpartAccount(accountId, parsed.data);
  return reply(c, result);
});

export default app;
