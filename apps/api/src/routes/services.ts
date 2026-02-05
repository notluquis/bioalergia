import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { cacheControl } from "../lib/cache-control";
import { serviceCreateSchema, serviceUpdateSchema } from "../lib/entity-schemas";
import {
  createService,
  deleteService,
  getServiceById,
  listServices,
  updateService,
} from "../services/services";
import { reply } from "../utils/reply";

const app = new Hono();

app.get("/", cacheControl(300), async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Service");
  const canReadList = await hasPermission(user.id, "read", "ServiceList");
  const canReadAgenda = await hasPermission(user.id, "read", "ServiceAgenda");
  const canReadTemplate = await hasPermission(user.id, "read", "ServiceTemplate");

  if (!canRead && !canReadList && !canReadAgenda && !canReadTemplate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const items = await listServices();
  return reply(c, { status: "ok", services: items });
});

app.get("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canRead = await hasPermission(user.id, "read", "Service");
  const canReadList = await hasPermission(user.id, "read", "ServiceList");
  const canReadAgenda = await hasPermission(user.id, "read", "ServiceAgenda");
  const canReadTemplate = await hasPermission(user.id, "read", "ServiceTemplate");

  if (!canRead && !canReadList && !canReadAgenda && !canReadTemplate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  const item = await getServiceById(id);
  if (!item) {
    return reply(c, { status: "error", message: "Not found" }, 404);
  }

  return reply(c, {
    status: "ok",
    service: item,
    schedules: [], // ServiceSchedule model not yet implemented
  });
});

app.post("/", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canCreate = await hasPermission(user.id, "create", "Service");
  if (!canCreate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const parsed = serviceCreateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  const result = await createService(parsed.data);
  return reply(c, {
    status: "ok",
    service: result,
    schedules: [], // ServiceSchedule model not yet implemented
  });
});

app.put("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  const body = await c.req.json();
  const parsed = serviceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  const result = await updateService(id, parsed.data);
  return reply(c, {
    status: "ok",
    service: result,
    schedules: [], // ServiceSchedule model not yet implemented
  });
});

app.delete("/:id", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canDelete = await hasPermission(user.id, "delete", "Service");
  if (!canDelete) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  await deleteService(id);
  return reply(c, { status: "ok" });
});

// POST /:id/schedules - Regenerate service schedules
// NOTE: ServiceSchedule model does not exist in the database schema.
// This is a placeholder to prevent 400 errors until the feature is implemented.
app.post("/:id/schedules", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (Number.isNaN(id)) {
    return reply(c, { status: "error", message: "Invalid ID" }, 400);
  }

  // TODO: Implement when ServiceSchedule model is added to schema
  return reply(c, { status: "error", message: "ServiceSchedule feature not yet implemented" }, 501);
});

export default app;
