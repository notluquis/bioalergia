import { db } from "@finanzas/db";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../auth";
import { cacheControl } from "../lib/cache-control";
import { reply } from "../utils/reply";

export type Variables = {
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
};

export const settingsRoutes = new Hono<{ Variables: Variables }>();

// Middleware to require auth
const requireAuth = async (c: Context<{ Variables: Variables }>, next: Next) => {
  const user = await getSessionUser(c);
  if (!user) {
    return reply(c, { status: "error", message: "No autorizado" }, 401);
  }
  c.set("user", user);
  await next();
};

// GET /internal
settingsRoutes.get("/internal", requireAuth, cacheControl(3600), async (c) => {
  const user = c.get("user");

  const canRead = await hasPermission(user.id, "read", "Setting");
  if (!canRead) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  // Fetch settings from DB
  const settings = await db.setting.findMany({
    where: { key: { in: ["internal.upsertChunkSize"] } },
  });

  const upsertChunkSize = settings.find((s) => s.key === "internal.upsertChunkSize")?.value;

  return reply(c, {
    internal: {
      upsertChunkSize: upsertChunkSize ? Number(upsertChunkSize) : undefined,
      envUpsertChunkSize: process.env.BIOALERGIA_UPSERT_CHUNK_SIZE || undefined,
    },
  });
});

// PUT /internal
// PUT /internal
settingsRoutes.put("/internal", requireAuth, async (c) => {
  const user = c.get("user");

  const canUpdate = await hasPermission(user.id, "update", "Setting");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  const body = await c.req.json();
  const { upsertChunkSize } = body; // expect object { upsertChunkSize: number | undefined }

  if (upsertChunkSize !== undefined) {
    await db.setting.upsert({
      where: { key: "internal.upsertChunkSize" },
      update: { value: String(upsertChunkSize) },
      create: {
        key: "internal.upsertChunkSize",
        value: String(upsertChunkSize),
      },
    });
  } else {
    // If empty/undefined, maybe delete? Frontend sends empty object to "delete" (reset)
    await db.setting.deleteMany({
      where: { key: "internal.upsertChunkSize" },
    });
  }

  return reply(c, { status: "ok" });
});

// Upload endpoints (Placeholder for now to avoid 404/400 if called)
// Upload endpoints
settingsRoutes.post("/logo/upload", requireAuth, async (c) => {
  const user = c.get("user");
  const canUpdate = await hasPermission(user.id, "update", "Setting");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  // Todo: Implement upload
  return reply(c, { status: "error", message: "Not implemented yet" }, 501);
});

settingsRoutes.post("/favicon/upload", requireAuth, async (c) => {
  const user = c.get("user");
  const canUpdate = await hasPermission(user.id, "update", "Setting");
  if (!canUpdate) {
    return reply(c, { status: "error", message: "Forbidden" }, 403);
  }

  // Todo: Implement upload
  return reply(c, { status: "error", message: "Not implemented yet" }, 501);
});
