import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { reply } from "../utils/reply";

const app = new Hono();

// POST /:id/pay - Register payment on a loan schedule (mark as PAID)
app.post("/:id/pay", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Loan");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const schedule = await db.loanSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return reply(c, { status: "error", message: "Schedule no encontrado" }, 404);
  }

  // Mark as PAID - schema only has status field for tracking
  const updated = await db.loanSchedule.update({
    where: { id },
    data: {
      status: "PAID",
    },
  });

  return reply(c, { status: "ok", schedule: updated });
});

// POST /:id/unlink - Unlink payment from a loan schedule (mark as PENDING)
app.post("/:id/unlink", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Loan");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const schedule = await db.loanSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return reply(c, { status: "error", message: "Schedule no encontrado" }, 404);
  }

  const updated = await db.loanSchedule.update({
    where: { id },
    data: {
      status: "PENDING",
    },
  });

  return reply(c, { status: "ok", schedule: updated });
});

export const loanScheduleRoutes = app;
