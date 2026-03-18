import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type AuthSession, getSessionUser, hasPermission } from "../auth";

type Variables = {
  user: AuthSession;
};

export const shareTargetRoutes = new Hono<{ Variables: Variables }>();

// Auth middleware
shareTargetRoutes.use("*", async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.text("Unauthorized", 401);
  }
  const canCreate = await hasPermission(user.id, "create", "Transaction");
  if (!canCreate) {
    return c.text("Forbidden", 403);
  }
  c.set("user", user);
  await next();
});

// POST /api/share-target
shareTargetRoutes.post(
  "/",
  bodyLimit({
    maxSize: 10 * 1024 * 1024, // 10MB
    onError: (c) => c.text("File too large", 413),
  }),
  async (c) => {
    try {
      const body = await c.req.parseBody();
      const { title, text, url } = body;
      console.log(`[ShareTarget] Received:`, { title, text, url });

      return c.redirect("/finanzas/movements", 303);
    } catch (err) {
      console.error("[ShareTarget] Error:", err);
      return c.text("Error processing share", 500);
    }
  },
);
