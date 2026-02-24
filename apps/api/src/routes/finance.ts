import type { Context } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { AppError } from "../lib/app-error";
import { zValidator } from "../lib/zod-validator";
import {
  createCompensationProfile,
  createFinancialAutoCategoryRule,
  createFinancialTransaction,
  createTransactionCategory,
  deleteFinancialAutoCategoryRule,
  deleteFinancialTransaction,
  deleteTransactionCategory,
  getFinancialSummaryByCategory,
  listAvailableFinancialTransactionMonths,
  listCompensationPeriodLedger,
  listCompensationProfiles,
  listFinancialAutoCategoryRules,
  listFinancialTransactions,
  listTransactionCategories,
  reallocateFinancialTransaction,
  syncFinancialTransactions,
  syncUncategorizedTransactionsByPatterns,
  updateCompensationProfile,
  updateFinancialAutoCategoryRule,
  updateFinancialTransaction,
  updateTransactionCategory,
  upsertCompensationPeriodBudget,
} from "../services/finance";
import { reply } from "../utils/reply";

const app = new Hono();

async function requireFinanceRead(c: Context) {
  const user = await getSessionUser(c);
  if (!user) {
    throw new AppError(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  const canRead = await hasPermission(user.id, "read", "Transaction");
  if (!canRead) {
    throw new AppError(403, {
      code: "FORBIDDEN",
      message: "No tienes permisos para realizar esta acción.",
    });
  }

  return user;
}

async function requireFinanceWrite(c: Context) {
  const user = await getSessionUser(c);
  if (!user) {
    throw new AppError(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  const canWrite = await hasPermission(user.id, "update", "Transaction");
  if (!canWrite) {
    throw new AppError(403, {
      code: "FORBIDDEN",
      message: "No tienes permisos para realizar esta acción.",
    });
  }

  return user;
}

// Schemas
const listSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  effectivePeriod: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
  categoryId: z.coerce.number().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  pageSize: z.coerce.number().optional().default(50),
});

const createSchema = z.object({
  date: z.string().transform((str) => new Date(str)),
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(["INCOME", "EXPENSE"]),
  categoryId: z.number().nullable().optional(),
  counterpartId: z.number().nullable().optional(),
  comment: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  isReconciled: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().optional(),
  isNonAccountable: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["INCOME", "EXPENSE"]).optional(),
  color: z.string().nullable().optional(),
  isNonAccountable: z.boolean().optional(),
});

const createAutoCategoryRuleSchema = z.object({
  categoryId: z.number().int().positive(),
  commentContains: z.string().nullable().optional(),
  counterpartId: z.number().int().positive().nullable().optional(),
  descriptionContains: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  maxAmount: z.number().nullable().optional(),
  minAmount: z.number().nullable().optional(),
  name: z.string().min(1),
  priority: z.number().int().optional(),
  type: z.enum(["INCOME", "EXPENSE"]).default("EXPENSE"),
});

const updateAutoCategoryRuleSchema = createAutoCategoryRuleSchema.partial();

const createCompensationProfileSchema = z.object({
  categoryId: z.number().int().positive(),
  counterpartId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1),
  timezone: z.string().min(1).optional(),
});

const updateCompensationProfileSchema = createCompensationProfileSchema.partial();

const upsertCompensationBudgetSchema = z.object({
  baseAmount: z.number(),
  isLocked: z.boolean().optional(),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const compensationLedgerQuerySchema = z.object({
  fromPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  toPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

const reallocateTransactionSchema = z.object({
  amount: z.number().positive(),
  fromPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  profileId: z.number().int().positive(),
  targetPeriod: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
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
  await requireFinanceRead(c);
  const query = c.req.valid("query");
  const filters = {
    ...query,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  };
  const result = await listFinancialTransactions(filters);
  return reply(c, { status: "ok", ...result });
});

app.get("/transactions/summary", zValidator("query", listSchema), async (c) => {
  await requireFinanceRead(c);
  const query = c.req.valid("query");
  const result = await getFinancialSummaryByCategory({
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
  });
  return reply(c, { status: "ok", ...result });
});

app.get("/transactions/available-months", async (c) => {
  await requireFinanceRead(c);
  const data = await listAvailableFinancialTransactionMonths();
  return reply(c, { status: "ok", data });
});

// 2. Create Transaction (Manual)
app.post("/transactions", zValidator("json", createSchema), async (c) => {
  await requireFinanceWrite(c);
  const data = c.req.valid("json");
  const result = await createFinancialTransaction(data);
  return reply(c, { status: "ok", data: result });
});

// 3. Update Transaction
app.put("/transactions/:id", zValidator("json", updateSchema), async (c) => {
  await requireFinanceWrite(c);
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");
  const result = await updateFinancialTransaction(id, data);
  return reply(c, { status: "ok", data: result });
});

// 4. Delete Transaction
app.delete("/transactions/:id", async (c) => {
  await requireFinanceWrite(c);
  const id = Number(c.req.param("id"));
  await deleteFinancialTransaction(id);
  return reply(c, { status: "ok", message: "Deleted" });
});

// 5. Sync (Trigger)
app.post("/sync", async (c) => {
  const user = await requireFinanceWrite(c);

  const result = await syncFinancialTransactions(user.id);
  return reply(c, { status: "ok", data: result });
});

app.post("/sync/uncategorized-patterns", async (c) => {
  await requireFinanceWrite(c);
  const result = await syncUncategorizedTransactionsByPatterns();
  return reply(c, { status: "ok", data: result });
});

// 6. Categories
app.get("/categories", async (c) => {
  await requireFinanceRead(c);
  const cats = await listTransactionCategories();
  return reply(c, { status: "ok", data: cats });
});

app.post("/categories", zValidator("json", createCategorySchema), async (c) => {
  await requireFinanceWrite(c);
  const data = c.req.valid("json");
  const result = await createTransactionCategory(data);
  return reply(c, { status: "ok", data: result });
});

app.put("/categories/:id", zValidator("json", updateCategorySchema), async (c) => {
  await requireFinanceWrite(c);
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");
  const result = await updateTransactionCategory(id, data);
  return reply(c, { status: "ok", data: result });
});

app.delete("/categories/:id", async (c) => {
  await requireFinanceWrite(c);
  const id = Number(c.req.param("id"));
  await deleteTransactionCategory(id);
  return reply(c, { status: "ok" });
});

// 7. Auto-category rules
app.get("/auto-category-rules", async (c) => {
  await requireFinanceRead(c);
  const rules = await listFinancialAutoCategoryRules();
  return reply(c, { status: "ok", data: rules });
});

app.post("/auto-category-rules", zValidator("json", createAutoCategoryRuleSchema), async (c) => {
  await requireFinanceWrite(c);
  const data = c.req.valid("json");
  const rule = await createFinancialAutoCategoryRule(data);
  return reply(c, { status: "ok", data: rule });
});

app.put("/auto-category-rules/:id", zValidator("json", updateAutoCategoryRuleSchema), async (c) => {
  await requireFinanceWrite(c);
  const id = Number(c.req.param("id"));
  const data = c.req.valid("json");
  const rule = await updateFinancialAutoCategoryRule(id, data);
  return reply(c, { status: "ok", data: rule });
});

app.delete("/auto-category-rules/:id", async (c) => {
  await requireFinanceWrite(c);
  const id = Number(c.req.param("id"));
  await deleteFinancialAutoCategoryRule(id);
  return reply(c, { status: "ok" });
});

// 8. Compensation profiles and period allocations
app.get("/compensation-profiles", async (c) => {
  await requireFinanceRead(c);
  const profiles = await listCompensationProfiles();
  return reply(c, { status: "ok", data: profiles });
});

app.post(
  "/compensation-profiles",
  zValidator("json", createCompensationProfileSchema),
  async (c) => {
    await requireFinanceWrite(c);
    const payload = c.req.valid("json");
    const profile = await createCompensationProfile(payload);
    return reply(c, { status: "ok", data: profile });
  },
);

app.put(
  "/compensation-profiles/:id",
  zValidator("json", updateCompensationProfileSchema),
  async (c) => {
    await requireFinanceWrite(c);
    const id = Number(c.req.param("id"));
    const payload = c.req.valid("json");
    const profile = await updateCompensationProfile(id, payload);
    return reply(c, { status: "ok", data: profile });
  },
);

app.put(
  "/compensation-profiles/:id/budget",
  zValidator("json", upsertCompensationBudgetSchema),
  async (c) => {
    await requireFinanceWrite(c);
    const id = Number(c.req.param("id"));
    const payload = c.req.valid("json");
    const budget = await upsertCompensationPeriodBudget(id, payload);
    return reply(c, { status: "ok", data: budget });
  },
);

app.get(
  "/compensation-profiles/:id/ledger",
  zValidator("query", compensationLedgerQuerySchema),
  async (c) => {
    await requireFinanceRead(c);
    const id = Number(c.req.param("id"));
    const { fromPeriod, toPeriod } = c.req.valid("query");
    const ledger = await listCompensationPeriodLedger(id, fromPeriod, toPeriod);
    return reply(c, { status: "ok", data: ledger });
  },
);

app.post(
  "/transactions/:id/reallocate",
  zValidator("json", reallocateTransactionSchema),
  async (c) => {
    await requireFinanceWrite(c);
    const id = Number(c.req.param("id"));
    const payload = c.req.valid("json");
    const allocation = await reallocateFinancialTransaction(id, payload);
    return reply(c, { status: "ok", data: allocation });
  },
);

export const financeRoutes = app;
