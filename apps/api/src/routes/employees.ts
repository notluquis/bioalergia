import { Hono } from "hono";
import { getSessionUser } from "../auth";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
} from "../services/employees";

const app = new Hono();

// GET / - List employees
app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const query = c.req.query();
  const includeInactive = query.includeInactive === "true";

  const employees = await listEmployees({ includeInactive });
  return c.json({ status: "ok", employees });
});

// POST / - Create employee
app.post("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();

  if (!body.rut || !body.full_name) {
    return c.json(
      { status: "error", message: "RUT y nombre completo son requeridos" },
      400
    );
  }

  const employee = await createEmployee(body);
  return c.json({ status: "ok", employee });
});

// PUT /:id - Update employee
app.put("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  const body = await c.req.json();
  const employee = await updateEmployee(id, body);
  return c.json({ status: "ok", employee });
});

// DELETE /:id - Deactivate employee
app.delete("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  await deactivateEmployee(id);
  return c.json({ status: "ok" });
});

export default app;
