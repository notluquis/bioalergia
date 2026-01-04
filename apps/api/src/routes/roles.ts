import { Hono } from "hono";
import { getSessionUser } from "../auth";
import {
  assignPermissionsToRole,
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  updateRole,
} from "../services/roles";
import {
  roleAssignPermissionsSchema,
  roleCreateSchema,
  roleUpdateSchema,
} from "../lib/entity-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const items = await listRoles();
  return c.json(items);
});

app.get("/permissions", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const items = await listPermissions();
  return c.json(items);
});

app.post("/", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const body = await c.req.json();
  const parsed = roleCreateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  try {
    const result = await createRole(parsed.data);
    return c.json(result);
  } catch (e: any) {
    return c.json({ status: "error", message: e.message }, 400);
  }
});

app.put("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const body = await c.req.json();
  const parsed = roleUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  try {
    const result = await updateRole(id, parsed.data);
    return c.json(result);
  } catch (e: any) {
    return c.json({ status: "error", message: e.message }, 400);
  }
});

app.delete("/:id", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  await deleteRole(id);
  return c.json({ status: "ok" });
});

app.post("/:id/permissions", async (c) => {
  const user = getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = roleAssignPermissionsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  await assignPermissionsToRole(id, parsed.data.permissionIds);
  return c.json({ status: "ok" });
});

export default app;
