import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { reply } from "../utils/reply";

const app = new Hono();

// NOTE: MonthlyExpense model does not exist in the database schema.
// These are placeholder routes to prevent 400 errors until the feature is implemented.

// GET / - List monthly expenses
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Expense");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  // Return empty list - feature not implemented
  return reply(c, { status: "ok", expenses: [] });
});

// GET /stats - Get expense statistics
app.get("/stats", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Expense");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  return reply(c, { status: "ok", stats: [] });
});

// GET /:publicId - Get expense detail
app.get("/:publicId", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Expense");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  return reply(c, { status: "error", message: "MonthlyExpense feature not yet implemented" }, 501);
});

// POST / - Create expense
app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Expense");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  return reply(c, { status: "error", message: "MonthlyExpense feature not yet implemented" }, 501);
});

// PUT /:publicId - Update expense
app.put("/:publicId", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Expense");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  return reply(c, { status: "error", message: "MonthlyExpense feature not yet implemented" }, 501);
});

// POST /:publicId/link - Link transaction to expense
app.post("/:publicId/link", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Expense");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  return reply(c, { status: "error", message: "MonthlyExpense feature not yet implemented" }, 501);
});

// POST /:publicId/unlink - Unlink transaction from expense
app.post("/:publicId/unlink", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Expense");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  return reply(c, { status: "error", message: "MonthlyExpense feature not yet implemented" }, 501);
});

export default app;
