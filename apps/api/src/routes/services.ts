import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import {
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
} from "../services/services";
import {
  serviceCreateSchema,
  serviceUpdateSchema,
} from "../lib/entity-schemas";

const app = new Hono();

app.get("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Service");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const items = await listServices();
  return c.json({ status: "ok", services: items });
});

app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canRead = await hasPermission(user.id, "read", "Service");
  if (!canRead) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const item = await getServiceById(id);
  if (!item) return c.json({ status: "error", message: "Not found" }, 404);

  return c.json({
    status: "ok",
    service: item,
    schedules: [], // ServiceSchedule model not yet implemented
  });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canCreate = await hasPermission(user.id, "create", "Service");
  if (!canCreate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = serviceCreateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await createService(parsed.data);
  return c.json({
    status: "ok",
    service: result,
    schedules: [], // ServiceSchedule model not yet implemented
  });
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  const body = await c.req.json();
  const parsed = serviceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { status: "error", message: "Invalid data", issues: parsed.error.issues },
      400
    );
  }

  const result = await updateService(id, parsed.data);
  return c.json({
    status: "ok",
    service: result,
    schedules: [], // ServiceSchedule model not yet implemented
  });
});

app.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canDelete = await hasPermission(user.id, "delete", "Service");
  if (!canDelete) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  await deleteService(id);
  return c.json({ status: "ok" });
});

// POST /:id/schedules - Regenerate service schedules
// NOTE: ServiceSchedule model does not exist in the database schema.
// This is a placeholder to prevent 400 errors until the feature is implemented.
app.post("/:id/schedules", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ status: "error", message: "Unauthorized" }, 401);

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) return c.json({ status: "error", message: "Forbidden" }, 403);

  const id = Number(c.req.param("id"));
  if (isNaN(id)) return c.json({ status: "error", message: "Invalid ID" }, 400);

  // TODO: Implement when ServiceSchedule model is added to schema
  return c.json(
    { status: "error", message: "ServiceSchedule feature not yet implemented" },
    501
  );
});

export default app;
