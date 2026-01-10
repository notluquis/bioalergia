/**
 * Supplies Routes
 * Migrated from apps/web/server/routes/supplies.ts
 */
import { Hono } from "hono";
import { reply } from "../utils/reply";
import {
  createSupplyRequest,
  getCommonSupplies,
  getSupplyRequests,
  updateSupplyRequestStatus,
} from "../services/supplies";
import {
  supplyRequestSchema,
  updateSupplyRequestStatusSchema,
} from "../lib/inventory-schemas";
import { getSessionUser, hasPermission } from "../auth";

export const suppliesRoutes = new Hono();

// Middleware to ensure user is authenticated
suppliesRoutes.use("*", async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }
  await next();
});

// GET /api/supplies/requests
suppliesRoutes.get("/requests", async (c) => {
  const user = await getSessionUser(c);
  if (user) {
    const canRead = await hasPermission(user.id, "read", "SupplyRequest");
    if (!canRead) return reply(c, { status: "error", message: "Forbidden" }, 403);
  }
  const requests = await getSupplyRequests();
  return reply(c, requests);
});

// GET /api/supplies/common
suppliesRoutes.get("/common", async (c) => {
  const supplies = await getCommonSupplies();
  return reply(c, supplies);
});

// POST /api/supplies/requests
suppliesRoutes.post("/requests", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "No autorizado" }, 401);

  const canCreate = await hasPermission(user.id, "create", "SupplyRequest");
  if (!canCreate) return reply(c, { status: "error", message: "Forbidden" }, 403);

  const body = await c.req.json();
  const parsed = supplyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return reply(c, 
      {
        status: "error",
        message: "Datos inválidos",
        issues: parsed.error.issues,
      },
      400
    );
  }

  await createSupplyRequest({
    userId: user.id,
    ...parsed.data,
  });

  return reply(c, { status: "ok" }, 201);
});

// PUT /api/supplies/:id/status
suppliesRoutes.put("/:id/status", async (c) => {
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = updateSupplyRequestStatusSchema.safeParse(body);
  if (!parsed.success) {
    return reply(c, { status: "error", message: "Estado inválido" }, 400);
  }

  const user = await getSessionUser(c);
  if (!user) return reply(c, { status: "error", message: "Unauthorized" }, 401);

  // Check for permission to update supply requests
  const canUpdate = await hasPermission(user.id, "update", "SupplyRequest");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }
  await updateSupplyRequestStatus(id, parsed.data.status);
  return reply(c, { status: "ok" });
});
