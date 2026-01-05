import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  getEmployeeById,
} from "../services/employees";

const app = new Hono();

// GET / - List employees
app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Employee");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const query = c.req.query();
    const includeInactive = query.includeInactive === "true";

    const employees = await listEmployees({ includeInactive });
    return c.json({ status: "ok", employees });
  } catch (error) {
    console.error("[employees] list error:", error);
    return c.json(
      { status: "error", message: "Error al listar empleados" },
      500
    );
  }
});

// GET /:id - Get single employee
app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Employee");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  try {
    const employee = await getEmployeeById(id);
    if (!employee) {
      return c.json(
        { status: "error", message: "Empleado no encontrado" },
        404
      );
    }
    return c.json({ status: "ok", employee });
  } catch (error) {
    console.error("[employees] get error:", error);
    return c.json(
      { status: "error", message: "Error al obtener empleado" },
      500
    );
  }
});

// POST / - Create employee
app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Employee");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  try {
    const body = await c.req.json();

    if (!body.rut || !body.full_name) {
      return c.json(
        { status: "error", message: "RUT y nombre completo son requeridos" },
        400
      );
    }

    const employee = await createEmployee(body);
    return c.json({ status: "ok", employee });
  } catch (error) {
    console.error("[employees] create error:", error);
    const message =
      error instanceof Error ? error.message : "Error al crear empleado";
    return c.json({ status: "error", message }, 500);
  }
});

// PUT /:id - Update employee
app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Employee");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  try {
    const body = await c.req.json();
    const employee = await updateEmployee(id, body);
    return c.json({ status: "ok", employee });
  } catch (error) {
    console.error("[employees] update error:", error);
    const message =
      error instanceof Error ? error.message : "Error al actualizar empleado";
    return c.json({ status: "error", message }, 500);
  }
});

// DELETE /:id - Deactivate employee
app.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canDelete = await hasPermission(user.id, "delete", "Employee");
  if (!canDelete) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ status: "error", message: "ID inválido" }, 400);
  }

  try {
    await deactivateEmployee(id);
    return c.json({ status: "ok" });
  } catch (error) {
    console.error("[employees] deactivate error:", error);
    const message =
      error instanceof Error ? error.message : "Error al desactivar empleado";
    return c.json({ status: "error", message }, 500);
  }
});

export default app;
