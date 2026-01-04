import { Hono } from "hono";
import { getSessionUser } from "../auth";
import {
  createLoan,
  deleteLoan,
  getLoanById,
  listLoans,
  updateLoan,
} from "../services/loans";
import { loanCreateSchema } from "../lib/financial-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const loans = await listLoans();
  return c.json({ status: "ok", loans });
});

app.post("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();
  const parsed = loanCreateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400
    );
  }

  const loan = await createLoan({
    ...parsed.data,
    status: "ACTIVE",
    createdAt: new Date(),
  });

  return c.json({ status: "ok", loan });
});

app.get("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  const loan = await getLoanById(id);
  if (!loan) {
    return c.json({ status: "error", message: "Préstamo no encontrado" }, 404);
  }

  return c.json({ status: "ok", loan });
});

app.put("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const parsed = loanCreateSchema.partial().safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400
    );
  }

  const loan = await updateLoan(id, parsed.data);
  return c.json({ status: "ok", loan });
});

app.delete("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  await deleteLoan(id);
  return c.json({ status: "ok" });
});

export default app;
