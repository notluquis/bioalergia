import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser } from "../auth";
import { zValidator } from "../lib/zod-validator";
import {
  createFinancialTransaction,
  createTransactionCategory,
  deleteFinancialTransaction,
  listFinancialTransactions,
  listTransactionCategories,
  syncFinancialTransactions,
  updateFinancialTransaction,
} from "../services/finance";
import { reply } from "../utils/reply";

const app = new Hono();

// Schemas
const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: z.coerce.number().optional(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(50),
});

const createSchema = z.object({
  date: z.string().transform((str) => new Date(str)),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  categoryId: z.number().optional(),
  counterpartId: z.number().optional(),
  comment: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  isReconciled: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  color: z.string().optional(),
});

// Middleware for auth
app.use("*", async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);
  // Determine strictness based on route? For now, allow logged in users to read, admins to write?
  // Or use permissions.
  await next();
});

// Routes

// 1. List Transactions
app.get("/transactions", zValidator("query", listSchema), async (c) => {
  const query = c.req.valid("query");
  const filters = {
    ...query,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
  const result = await listFinancialTransactions(filters);
  return reply(c, { status: "ok", ...result });
});

// 2. Create Transaction (Manual)
app.post("/transactions", zValidator("json", createSchema), async (c) => {
  const data = c.req.valid("json");
  const result = await createFinancialTransaction({
    ...data,
    source: "MANUAL",
  });
  return reply(c, { status: "ok", data: result });
});

// 3. Update Transaction
app.put("/transactions/:id", zValidator("json", updateSchema), async (c) => {
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");
  const result = await updateFinancialTransaction(id, data);
  return reply(c, { status: "ok", data: result });
});

// 4. Delete Transaction
app.delete("/transactions/:id", async (c) => {
  const id = Number(c.req.param("id"));
  await deleteFinancialTransaction(id);
  return reply(c, { status: "ok", message: "Deleted" });
});

// 5. Sync (Trigger)
app.post("/sync", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error" }, 401);

  const result = await syncFinancialTransactions(user.id);
  return reply(c, { status: "ok", data: result });
});

// 6. Categories
app.get("/categories", async (c) => {
  const cats = await listTransactionCategories();
  return reply(c, { status: "ok", data: cats });
});

app.post("/categories", zValidator("json", createCategorySchema), async (c) => {
  const data = c.req.valid("json");
  const result = await createTransactionCategory(data);
  return reply(c, { status: "ok", data: result });
});

export const financeRoutes = app;
