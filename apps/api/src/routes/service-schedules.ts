import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { reply } from "../utils/reply";

const app = new Hono();

// POST /:id/pay - Register payment on a service schedule
// NOTE: ServiceSchedule model does not exist in the database schema.
// This is a placeholder to prevent 400 errors until the feature is implemented.
app.post("/:id/pay", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  // TODO: Implement when ServiceSchedule model is added to schema
  return reply(c, { status: "error", message: "ServiceSchedule feature not yet implemented" }, 501);
});

// POST /:id/unlink - Unlink payment from a service schedule
app.post("/:id/unlink", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "Unauthorized" }, 401);
  }

  const canUpdate = await hasPermission(user.id, "update", "Service");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return reply(c, { status: "error", message: "ID inválido" }, 400);
  }

  // TODO: Implement when ServiceSchedule model is added to schema
  return reply(c, { status: "error", message: "ServiceSchedule feature not yet implemented" }, 501);
});

export const serviceScheduleRoutes = app;
