import { Hono } from "hono";
import { getSessionUser } from "../auth";
import { db } from "@finanzas/db";

const app = new Hono();

// POST /:id/pay - Register payment on a loan schedule (mark as PAID)
app.post("/:id/pay", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  const schedule = await db.loanSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return c.json({ status: "error", message: "Schedule no encontrado" }, 404);
  }

  // Mark as PAID - schema only has status field for tracking
  const updated = await db.loanSchedule.update({
    where: { id },
    data: {
      status: "PAID",
    },
  });

  return c.json({ status: "ok", schedule: updated });
});

// POST /:id/unlink - Unlink payment from a loan schedule (mark as PENDING)
app.post("/:id/unlink", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  const schedule = await db.loanSchedule.findUnique({ where: { id } });
  if (!schedule) {
    return c.json({ status: "error", message: "Schedule no encontrado" }, 404);
  }

  const updated = await db.loanSchedule.update({
    where: { id },
    data: {
      status: "PENDING",
    },
  });

  return c.json({ status: "ok", schedule: updated });
});

export default app;
