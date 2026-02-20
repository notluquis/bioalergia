import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";
import { Hono } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { reply } from "../utils/reply";

const app = new Hono();

const RELEASE_ID_OFFSET = -1_000_000_000;
const WITHDRAW_ID_OFFSET = -2_000_000_000;

const paySchema = z.object({
  note: z.string().max(1000).optional().nullable(),
  paidAmount: z.coerce.number().min(0),
  paidDate: z.string().min(1),
  transactionId: z.coerce.number().int(),
  transactionSource: z.enum(["release", "settlement", "withdraw"]).optional(),
});

const editSchema = z.object({
  dueDate: z.string().min(1).optional(),
  expectedAmount: z.coerce.number().min(0).optional(),
  note: z.string().max(1000).optional().nullable(),
});

const skipSchema = z.object({
  reason: z.string().min(1).max(500),
});

type TransactionSource = "release" | "settlement" | "withdraw";

function decodeUnifiedId(
  transactionId: number,
): null | { rawId: number; source: TransactionSource } {
  if (transactionId > 0) {
    return { rawId: transactionId, source: "settlement" };
  }

  if (transactionId <= WITHDRAW_ID_OFFSET - 1) {
    const rawId = WITHDRAW_ID_OFFSET - transactionId;
    return rawId > 0 ? { rawId, source: "withdraw" } : null;
  }

  if (transactionId <= RELEASE_ID_OFFSET - 1 && transactionId > WITHDRAW_ID_OFFSET - 1) {
    const rawId = RELEASE_ID_OFFSET - transactionId;
    return rawId > 0 ? { rawId, source: "release" } : null;
  }

  return null;
}

function normalizeTransactionReference(
  transactionId: number,
  transactionSource?: TransactionSource,
): null | { rawId: number; source: TransactionSource } {
  if (transactionSource) {
    if (transactionId > 0) {
      return { rawId: transactionId, source: transactionSource };
    }
    const decoded = decodeUnifiedId(transactionId);
    if (!decoded || decoded.source !== transactionSource) {
      return null;
    }
    return decoded;
  }
  return decodeUnifiedId(transactionId);
}

// PATCH /:id - Edit a service schedule (dueDate, expectedAmount, note)
app.patch("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const schedule = await db.serviceSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return reply(c, { status: "error", message: "Schedule no encontrado" }, 404);
  }

  // Build update data object
  const updateData: {
    dueDate?: Date;
    expectedAmount?: Decimal;
    note?: null | string;
  } = {};

  if (parsed.data.dueDate !== undefined) {
    updateData.dueDate = new Date(parsed.data.dueDate);
  }

  if (parsed.data.expectedAmount !== undefined) {
    updateData.expectedAmount = new Decimal(parsed.data.expectedAmount);
  }

  if (parsed.data.note !== undefined) {
    updateData.note = parsed.data.note;
  }

  const updated = await db.serviceSchedule.update({
    where: { id },
    data: updateData,
  });

  return reply(c, { status: "ok", schedule: updated });
});

app.post("/:id/pay", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = paySchema.safeParse(body);
  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const schedule = await db.serviceSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return reply(c, { status: "error", message: "Schedule no encontrado" }, 404);
  }

  const txRef = normalizeTransactionReference(
    parsed.data.transactionId,
    parsed.data.transactionSource,
  );
  if (!txRef) {
    return reply(c, { status: "error", message: "Referencia de transacción inválida" }, 400);
  }

  if (txRef.source === "settlement") {
    const found = await db.settlementTransaction.findUnique({ where: { id: txRef.rawId } });
    if (!found) {
      return reply(c, { status: "error", message: "Settlement transaction no encontrada" }, 404);
    }
  } else if (txRef.source === "release") {
    const found = await db.releaseTransaction.findUnique({ where: { id: txRef.rawId } });
    if (!found) {
      return reply(c, { status: "error", message: "Release transaction no encontrada" }, 404);
    }
  } else {
    const found = await db.withdrawTransaction.findUnique({ where: { id: txRef.rawId } });
    if (!found) {
      return reply(c, { status: "error", message: "Withdraw transaction no encontrada" }, 404);
    }
  }

  const paidAmount = new Decimal(parsed.data.paidAmount);
  const dueAmount = new Decimal(schedule.effectiveAmount.toString());
  const status = paidAmount.greaterThanOrEqualTo(dueAmount) ? "PAID" : "PARTIAL";

  const updated = await db.serviceSchedule.update({
    where: { id },
    data: {
      paidAmount,
      paidDate: new Date(parsed.data.paidDate),
      note: parsed.data.note ?? schedule.note,
      status,
      financialTransactionId: null,
      settlementTransactionId: txRef.source === "settlement" ? txRef.rawId : null,
      releaseTransactionId: txRef.source === "release" ? txRef.rawId : null,
      withdrawTransactionId: txRef.source === "withdraw" ? txRef.rawId : null,
    },
  });

  return reply(c, { status: "ok", schedule: updated });
});

// POST /:id/unlink - Unlink payment from a service schedule
app.post("/:id/unlink", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const schedule = await db.serviceSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return reply(c, { status: "error", message: "Schedule no encontrado" }, 404);
  }

  const updated = await db.serviceSchedule.update({
    where: { id },
    data: {
      paidAmount: null,
      paidDate: null,
      status: "PENDING",
      financialTransactionId: null,
      settlementTransactionId: null,
      releaseTransactionId: null,
      withdrawTransactionId: null,
    },
  });

  return reply(c, { status: "ok", schedule: updated });
});

// POST /:id/skip - Skip a service schedule with a reason
app.post("/:id/skip", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = skipSchema.safeParse(body);
  if (!parsed.success) {
    return reply(
      c,
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400,
    );
  }

  const schedule = await db.serviceSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return reply(c, { status: "error", message: "Schedule no encontrado" }, 404);
  }

  const updated = await db.serviceSchedule.update({
    where: { id },
    data: {
      status: "SKIPPED",
      note: parsed.data.reason,
    },
  });

  return reply(c, { status: "ok", schedule: updated });
});

export const serviceScheduleRoutes = app;
