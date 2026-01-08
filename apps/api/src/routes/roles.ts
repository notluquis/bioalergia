import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  assignPermissionsToRole,
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  syncPermissions,
  updateRole,
} from "../services/roles";
import {
  roleAssignPermissionsSchema,
  roleCreateSchema,
  roleUpdateSchema,
} from "../lib/entity-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Role");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const items = await listRoles();
  return c.json({ status: "ok", roles: items });
});

app.get("/permissions", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Permission");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const items = await listPermissions();
  return c.json({ status: "ok", permissions: items });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Role");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

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
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Role");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

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
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canDelete = await hasPermission(user.id, "delete", "Role");
  if (!canDelete) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  await deleteRole(id);
  return c.json({ status: "ok" });
});

app.post("/:id/permissions", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  // Updating a role's permissions is arguably 'update Role'
  const canUpdate = await hasPermission(user.id, "update", "Role");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

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

// Sync permissions - generates CRUD permissions for all subjects
app.post("/permissions/sync", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  try {
    const canManageRoles = await hasPermission(user.id, "update", "Role");
    if (!canManageRoles)
      return c.json({ status: "error", message: "Forbidden" }, 403);

    const result = await syncPermissions();
    return c.json({ status: "ok", ...result });
  } catch (e: any) {
    return c.json({ status: "error", message: e.message }, 500);
  }
});

export default app;
