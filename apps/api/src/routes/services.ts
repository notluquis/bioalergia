import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { cacheControl } from "../lib/cache-control";
import { serviceCreateSchema, serviceUpdateSchema } from "../lib/entity-schemas";
import {
  createService,
  deleteService,
  generateSchedules,
  getServiceByIdOrPublicId,
  listServices,
  updateService,
} from "../services/services";
import { toSnakeCase } from "../utils/case-transform";
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
  return reply(c, { status: "ok", services: toSnakeCase(items) });
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

  const identifier = c.req.param("id");
  const item = await getServiceByIdOrPublicId(identifier);

  if (!item) {
    return reply(c, { status: "error", message: "Not found" }, 404);
  }

  const schedules = await db.serviceSchedule.findMany({
    where: { serviceId: item.id },
    orderBy: { periodStart: "asc" },
  });

  return reply(c, {
    status: "ok",
    service: toSnakeCase(item),
    schedules: toSnakeCase(schedules),
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
    service: toSnakeCase(result),
    schedules: [],
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

  const identifier = c.req.param("id");
  const existing = await getServiceByIdOrPublicId(identifier);

  if (!existing) {
    return reply(c, { status: "error", message: "Not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = serviceUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return reply(c, { status: "error", message: "Invalid data", issues: parsed.error.issues }, 400);
  }

  const result = await updateService(existing.id, parsed.data);

  const schedules = await db.serviceSchedule.findMany({
    where: { serviceId: result.id },
    orderBy: { periodStart: "asc" },
  });

  return reply(c, {
    status: "ok",
    service: toSnakeCase(result),
    schedules: toSnakeCase(schedules),
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

  const identifier = c.req.param("id");
  const existing = await getServiceByIdOrPublicId(identifier);

  if (!existing) {
    return reply(c, { status: "error", message: "Not found" }, 404);
  }

  await deleteService(existing.id);
  return reply(c, { status: "ok" });
});

// POST /:id/schedules - Generate service schedules
app.post("/:id/schedules", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const identifier = c.req.param("id");
  const existing = await getServiceByIdOrPublicId(identifier);

  if (!existing) {
    return reply(c, { status: "error", message: "Not found" }, 404);
  }

  const query = c.req.query();
  const months = query.months ? Number(query.months) : undefined;
  const fromDate = query.fromDate ? new Date(query.fromDate) : undefined;

  if (months !== undefined && (Number.isNaN(months) || months < 1 || months > 120)) {
    return reply(c, { status: "error", message: "Invalid months parameter (1-120)" }, 400);
  }

  if (fromDate !== undefined && Number.isNaN(fromDate.getTime())) {
    return reply(c, { status: "error", message: "Invalid fromDate parameter" }, 400);
  }

  try {
    const result = await generateSchedules({ serviceId: existing.id, months, fromDate });
    return reply(c, { status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate schedules";
    return reply(c, { status: "error", message }, 500);
  }
});

export const serviceRoutes = app;
