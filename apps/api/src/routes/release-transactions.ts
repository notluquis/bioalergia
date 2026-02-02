import { authDb } from "@finanzas/db";
import type { ReleaseTransactionWhereInput } from "@finanzas/db/input";
import { Hono } from "hono";
import { z } from "zod";

import { getSessionUser, hasPermission } from "../auth";
import { reply } from "../utils/reply";

const NUMERIC_PATTERN = /^\d+$/;

const app = new Hono();

// GET /api/release-transactions
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
    search: z.string().optional(),
    descriptions: z.string().optional(),
  });

  const parsed = querySchema.safeParse(query);

  if (!parsed.success) {
    return c.json({ status: "error", message: "Invalid params" }, 400);
  }

  const { page, pageSize, from, to, paymentMethod, search, descriptions } = parsed.data;
  const offset = (page - 1) * pageSize;

  // Build where clause using type-safe ReleaseTransactionWhereInput
  const whereConditions: ReleaseTransactionWhereInput[] = [];

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) dateFilter.lte = new Date(to);
    whereConditions.push({ date: dateFilter });
  }

  if (paymentMethod) {
    whereConditions.push({ paymentMethod });
  }

  if (descriptions) {
    const list = descriptions.split(",").map((d) => d.trim());
    whereConditions.push({ description: { in: list } });
  }

  if (search) {
    const isNumeric = NUMERIC_PATTERN.test(search);
    whereConditions.push({
      OR: [
        { externalReference: { contains: search, mode: "insensitive" } },
        { sourceId: { contains: search, mode: "insensitive" } },
        ...(isNumeric ? [{ orderId: Number(search) }] : []),
      ],
    });
  }

  // Combine conditions with AND
  const where: ReleaseTransactionWhereInput =
    whereConditions.length === 1
      ? whereConditions[0]
      : whereConditions.length > 1
        ? { AND: whereConditions }
        : {};

  // Create user-bound client for policy enforcement
  const userDb = authDb.$setAuth(user);

  const [total, data] = await Promise.all([
    userDb.releaseTransaction.count({ where }),
    userDb.releaseTransaction.findMany({
      where,
      orderBy: { date: "desc" },
      skip: offset,
      take: pageSize,
    }),
  ]);

  return reply(c, {
    status: "ok",
    data,
    total,
    page: Number(page),
    pageSize: Number(pageSize),
    totalPages: Math.ceil(total / Number(pageSize)),
  });
});

// GET /api/release-transactions/:id
app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Integration");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));

  // Create user-bound client for policy enforcement
  const userDb = authDb.$setAuth(user);
  const transaction = await userDb.releaseTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    return c.json({ status: "error", message: "Transacción no encontrada" }, 404);
  }

  return c.json({ status: "ok", data: transaction });
});

export default app;
