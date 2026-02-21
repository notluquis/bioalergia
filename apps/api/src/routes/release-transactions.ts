import { authDb } from "@finanzas/db";
import type { ReleaseTransactionWhereInput } from "@finanzas/db/input";
import { type Context, Hono } from "hono";
import { z } from "zod";

import { getSessionUser, hasPermission } from "../auth";
import { AppError } from "../lib/app-error";
import { errorReply } from "../utils/error-reply";
import { reply } from "../utils/reply";

const NUMERIC_PATTERN = /^\d+$/;

const app = new Hono();

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  from: z.string().optional(),
  to: z.string().optional(),
  paymentMethod: z.string().optional(),
  search: z.string().optional(),
  descriptions: z.string().optional(),
});

async function requireIntegrationRead(c: Context) {
  const user = await getSessionUser(c);
  if (!user) {
    throw new AppError(401, { code: "UNAUTHORIZED", message: "Unauthorized" });
  }

  const canRead = await hasPermission(user.id, "read", "Integration");
  if (!canRead) {
    throw new AppError(403, { code: "FORBIDDEN", message: "Forbidden" });
  }

  return user;
}

function buildReleaseWhere(input: z.infer<typeof querySchema>): ReleaseTransactionWhereInput {
  const { from, to, paymentMethod, search, descriptions } = input;
  const whereConditions: ReleaseTransactionWhereInput[] = [];

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) {
      dateFilter.gte = new Date(from);
    }
    if (to) {
      dateFilter.lte = new Date(to);
    }
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

  if (whereConditions.length === 1) {
    return whereConditions[0];
  }
  if (whereConditions.length > 1) {
    return { AND: whereConditions };
  }
  return {};
}

// GET /api/release-transactions
app.get("/", async (c) => {
  const user = await requireIntegrationRead(c);

  const parsed = querySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return errorReply(c, 400, "Invalid params", {
      code: "VALIDATION_ERROR",
      details: { issues: parsed.error.issues },
    });
  }

  const { page, pageSize } = parsed.data;
  const offset = (page - 1) * pageSize;

  const where = buildReleaseWhere(parsed.data);

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
  const user = await requireIntegrationRead(c);

  const id = Number(c.req.param("id"));

  // Create user-bound client for policy enforcement
  const userDb = authDb.$setAuth(user);
  const transaction = await userDb.releaseTransaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    throw new AppError(404, {
      code: "TRANSACTION_NOT_FOUND",
      message: "Transacción no encontrada",
    });
  }

  return reply(c, { status: "ok", data: transaction });
});

export const releaseTransactionRoutes = app;
