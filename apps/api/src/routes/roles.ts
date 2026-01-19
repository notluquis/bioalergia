import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { cacheControl } from "../lib/cache-control";
import {
  roleAssignPermissionsSchema,
  roleCreateSchema,
  roleUpdateSchema,
} from "../lib/entity-schemas";
import {
  assignPermissionsToRole,
  createRole,
  deleteRole,
  listPermissions,
  listRoles,
  syncPermissions,
  updateRole,
} from "../services/roles";
import { reply } from "../utils/reply";

const app = new Hono();

app.get("/", cacheControl(300), async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Role");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const items = await listRoles();
  return reply(c, { status: "ok", roles: items });
});

app.get("/permissions", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Permission");
  if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const items = await listPermissions();
  return reply(c, { status: "ok", permissions: items });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Role");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = roleCreateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  try {
    const result = await createRole(parsed.data);
    return reply(c, result);
    // biome-ignore lint/suspicious/noExplicitAny: error handling
  } catch (e: any) {
    return reply(c, { status: "error", message: e.message }, 400);
  }
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Role");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return reply(c, { status: "error", message: "Invalid ID" }, 400);

  const body = await c.req.json();
  const parsed = roleUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  try {
    const result = await updateRole(id, parsed.data);
    return reply(c, result);
    // biome-ignore lint/suspicious/noExplicitAny: error handling
  } catch (e: any) {
    return reply(c, { status: "error", message: e.message }, 400);
  }
});

app.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  const canDelete = await hasPermission(user.id, "delete", "Role");
  if (!canDelete) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) return reply(c, { status: "error", message: "Invalid ID" }, 400);

  await deleteRole(id);
  return reply(c, { status: "ok" });
});

app.post("/:id/permissions", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  // Updating a role's permissions is arguably 'update Role'
  const canUpdate = await hasPermission(user.id, "update", "Role");
  if (!canUpdate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = roleAssignPermissionsSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  await assignPermissionsToRole(id, parsed.data.permissionIds);
  return reply(c, { status: "ok" });
});

// Sync permissions - generates CRUD permissions for all subjects
app.post("/permissions/sync", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  try {
    const canManageRoles = await hasPermission(user.id, "update", "Role");
    if (!canManageRoles) return reply(c, { status: "error", message: "Forbidden" }, 403);

    const result = await syncPermissions();
    return reply(c, { status: "ok", ...result });
    // biome-ignore lint/suspicious/noExplicitAny: error handling
  } catch (e: any) {
    console.error("[syncPermissions] Error details:", e);
    return reply(c, { status: "error", message: e.message }, 500);
  }
});

export default app;
