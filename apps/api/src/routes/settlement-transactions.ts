import { Hono } from "hono";
import { enhance } from "@zenstackhq/orm";
import { z } from "zod";

import { db } from "@finanzas/db";
import { getSessionUser, hasPermission } from "../auth";

const app = new Hono();

// GET /api/settlement-transactions
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const query = c.req.query();
  const querySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    from: z.string().optional(),
    to: z.string().optional(),
    paymentMethod: z.string().optional(),
    transactionType: z.string().optional(),
    search: z.string().optional(),
  });

  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    return c.json({ status: "error", message: "Invalid params" }, 400);
  }

  const { page, pageSize, from, to, paymentMethod, transactionType, search } =
    parsed.data;
  const offset = (page - 1) * pageSize;

  // Enhanced DB with ZenStack policies
  const enhancedDb = enhance(db, { user });

  // Build where clause
  const where: any = {};

  if (from) {
    where.transactionDate = { ...where.transactionDate, gte: new Date(from) };
  }

  if (to) {
    where.transactionDate = { ...where.transactionDate, lte: new Date(to) };
  }

  if (paymentMethod) {
    where.OR = [
      { paymentMethod: paymentMethod },
      { paymentMethodType: paymentMethod },
    ];
  }

  if (transactionType) {
    where.transactionType = transactionType;
  }

  if (search) {
    const isNumeric = /^\d+$/.test(search);
    where.OR = [
      { externalReference: { contains: search, mode: "insensitive" } },
      { sourceId: { contains: search, mode: "insensitive" } },
      ...(isNumeric ? [{ orderId: Number(search) }] : []),
    ];
  }

  // Using enhancedDb ensures schema policies are applied automatically
  const [total, data] = await Promise.all([
    enhancedDb.settlementTransaction.count({ where }),
    enhancedDb.settlementTransaction.findMany({
      where,
      orderBy: { transactionDate: "desc" },
      skip: offset,
      take: pageSize,
      select: {
        id: true,
        sourceId: true,
        transactionDate: true,
        settlementDate: true,
        transactionType: true,
        transactionAmount: true,
        transactionCurrency: true,
        settlementNetAmount: true,
        paymentMethod: true,
        paymentMethodType: true,
        externalReference: true,
        feeAmount: true,
        sellerAmount: true,
      },
    }),
  ]);

  return c.json({
    status: "ok",
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
});

// GET /api/settlement-transactions/:id
app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));

  const enhancedDb = enhance(db, { user });
  const transaction = await enhancedDb.settlementTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    return c.json(
      { status: "error", message: "Transacción no encontrada" },
      404
    );
  }

  return c.json({ status: "ok", data: transaction });
});

export default app;
