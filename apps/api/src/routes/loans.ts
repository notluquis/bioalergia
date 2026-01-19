import { db } from "@finanzas/db";
import { Decimal } from "decimal.js";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { loanCreateSchema } from "../lib/financial-schemas";
import { createLoan, deleteLoan, getLoanById, listLoans, updateLoan } from "../services/loans";
import { reply } from "../utils/reply";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Loan");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const loans = await listLoans();
  return reply(c, { status: "ok", loans });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Loan");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = loanCreateSchema.safeParse(body);

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

  const loan = await createLoan({
    ...parsed.data,
    status: "ACTIVE",
    createdAt: new Date(),
  });

  return reply(c, { status: "ok", loan });
});

app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Loan");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const loan = await getLoanById(id);
  if (!loan) {
    return reply(c, { status: "error", message: "Préstamo no encontrado" }, 404);
  }

  return reply(c, { status: "ok", loan });
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Loan");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = loanCreateSchema.partial().safeParse(body);

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

  const loan = await updateLoan(id, parsed.data);
  return reply(c, { status: "ok", loan });
});

app.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canDelete = await hasPermission(user.id, "delete", "Loan");
  if (!canDelete) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  await deleteLoan(id);
  return reply(c, { status: "ok" });
});

// POST /:id/schedules - Regenerate loan schedules
app.post("/:id/schedules", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Loan");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  const loan = await getLoanById(id);
  if (!loan) {
    return reply(c, { status: "error", message: "Préstamo no encontrado" }, 404);
  }

  const body = await c.req.json();
  const { startDate, installments } = body;

  // Delete existing schedules
  await db.loanSchedule.deleteMany({ where: { loanId: id } });

  // Generate new schedules
  const scheduleData = [];
  const start = new Date(startDate || loan.startDate || new Date());
  const totalInstallments = installments || loan.schedules.length || 12;
  const installmentAmount = Number(loan.principalAmount) / totalInstallments;

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = new Date(start);
    dueDate.setMonth(dueDate.getMonth() + i);

    scheduleData.push({
      loanId: id,
      installmentNumber: i,
      dueDate,
      expectedAmount: new Decimal(installmentAmount),
      status: "PENDING" as const,
    });
  }

  await db.loanSchedule.createMany({ data: scheduleData });

  const updatedLoan = await getLoanById(id);
  return reply(c, { status: "ok", loan: updatedLoan });
});

export default app;
