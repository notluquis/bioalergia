import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  counterpartAccountPayloadSchema,
  counterpartAccountUpdateSchema,
  counterpartPayloadSchema,
} from "../lib/entity-schemas";
import {
  attachRutToCounterpart,
  createCounterpart,
  getCounterpartById,
  getCounterpartSuggestions,
  listCounterparts,
  syncCounterpartsFromTransactions,
  updateCounterpart,
  updateCounterpartAccount,
  upsertCounterpartAccount,
} from "../services/counterparts";
import { reply } from "../utils/reply";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Counterpart");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const items = await listCounterparts();
  return reply(c, { status: "ok", counterparts: items });
});

app.post("/sync", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  try {
    const result = await syncCounterpartsFromTransactions();
    return reply(c, { status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync counterparts";
    return reply(c, { status: "error", message }, 500);
  }
});

app.get("/suggestions", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Counterpart");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const query = c.req.query("q");
  const limitRaw = Number(c.req.query("limit") ?? 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 10;

  if (!query || query.trim().length === 0) {
    return reply(c, { status: "ok", suggestions: [] });
  }

  const suggestions = await getCounterpartSuggestions(query, limit);
  return reply(c, { status: "ok", suggestions });
});

app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Counterpart");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  const result = await getCounterpartById(id);
  if (!result) {
    return reply(c, { status: "error", message: "Not found" }, 404);
  }

  return reply(c, {
    status: "ok",
    counterpart: result.counterpart,
    accounts: result.accounts,
  });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "Counterpart");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = counterpartPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  try {
    const result = await createCounterpart({
      identificationNumber: parsed.data.identificationNumber,
      bankAccountHolder: parsed.data.bankAccountHolder,
      category: parsed.data.category,
      notes: parsed.data.notes,
    });
    return reply(c, {
      status: "ok",
      counterpart: result,
      accounts: result.accounts ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create counterpart";
    return reply(c, { status: "error", message }, 400);
  }
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  const body = await c.req.json();
  const parsed = counterpartPayloadSchema.partial().safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  try {
    const result = await updateCounterpart(id, parsed.data);
    return reply(c, {
      status: "ok",
      counterpart: result,
      accounts: result.accounts ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update counterpart";
    return reply(c, { status: "error", message }, 400);
  }
});

// Attach RUT to existing counterpart
app.post("/:id/attach-rut", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  const body = await c.req.json();
  const { rut } = body;

  if (!rut) {
    return reply(c, { status: "error", message: "RUT is required" }, 400);
  }

  try {
    const accounts = await attachRutToCounterpart(id, rut);
    return reply(c, { status: "ok", accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to attach RUT";
    return reply(c, { status: "error", message }, 400);
  }
});

// Get summary for a counterpart
app.get("/:id/summary", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Counterpart");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  try {
    const counterpart = await getCounterpartById(id);
    // Get summary of transactions for this counterpart
    const withdrawTotal =
      counterpart.counterpart.withdrawTransactions?.reduce(
        (sum, tx) => sum + (tx.amount ? Number(tx.amount) : 0),
        0,
      ) ?? 0;

    const releaseTotal =
      counterpart.counterpart.releaseTransactions?.reduce(
        (sum, tx) => sum + (tx.grossAmount ? Number(tx.grossAmount) : 0),
        0,
      ) ?? 0;

    return reply(c, {
      status: "ok",
      summary: {
        withdrawTotal,
        releaseTotal,
        settlementCount: counterpart.counterpart.settlementTransactions?.length ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Not found";
    return reply(c, { status: "error", message }, 404);
  }
});

// Accounts Sub-resource

app.post("/:id/accounts", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }
  const body = await c.req.json();
  const parsed = counterpartAccountPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  const result = await upsertCounterpartAccount(id, {
    accountNumber: parsed.data.accountIdentifier ?? parsed.data.accountNumber ?? "",
    bankName: parsed.data.bankName,
    accountType: parsed.data.accountType,
  });
  return reply(c, { status: "ok", accounts: [result] });
});

app.put("/accounts/:accountId", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Counterpart");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const accountId = Number(c.req.param("accountId"));
  if (Number.isNaN(accountId)) {
    return reply(c, { status: "error", message: "Invalid account ID" }, 400);
  }
  const body = await c.req.json();
  const parsed = counterpartAccountUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  const result = await updateCounterpartAccount(accountId, parsed.data);
  return reply(c, result);
});

export const counterpartRoutes = app;
