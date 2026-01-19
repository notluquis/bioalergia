import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { type AuthSession, getSessionUser, hasPermission } from "../auth";

type Variables = {
  user: AuthSession;
};

export const shareTargetRoutes = new Hono<{ Variables: Variables }>();

// Ensure uploads directory exists
const _uploadDir = path.join(process.cwd(), "..", "..", "uploads", "shared"); // Adjust path relative to apps/api?
// Actually process.cwd() in apps/api likely points to apps/api root or monorepo root depending on how it's run.
// If running from monorepo root: uploads/shared.
// If running from apps/api: ../../uploads/shared?
// Let's assume a standard uploads folder. The original code was process.cwd() + uploads/shared.
// In newer structure, maybe `apps/api/uploads` or shared root `uploads`.
// I'll stick to `process.cwd()/uploads/shared` but ensuring it's robust.
// Given strict Hono/ZenStack structure, maybe we should be careful.
// I'll use `process.env.UPLOAD_DIR` or default to `./uploads` in `apps/api`.
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "shared");

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

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
      const media = body.media; // Can be File or string or array

      const { title, text, url } = body;
      console.log(`[ShareTarget] Received:`, { title, text, url });

      if (!media) {
        // Just text shared?
        return c.redirect("/finanzas/movements", 303);
      }

      // Handle file
      // Hono returns Web API File object for files
      const file =
        media instanceof File
          ? media
          : Array.isArray(media) && media[0] instanceof File
            ? media[0]
            : null;

      if (!file) {
        // No valid file found
        return c.redirect("/finanzas/movements", 303);
      }

      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const originalName = file.name;
      const ext = path.extname(originalName);
      const name = path.basename(originalName, ext).replace(/[^a-z0-9]/gi, "_");
      const filename = `${name}-${uniqueSuffix}${ext}`;
      const filepath = path.join(UPLOAD_ROOT, filename);

      const buffer = await file.arrayBuffer();
      fs.writeFileSync(filepath, Buffer.from(buffer));

      console.log(`[ShareTarget] Saved file: ${filename}`);

      // Redirect to frontend with filename query param
      // Assuming frontend is served at root or specific URL
      // Original code: res.redirect(303, `/finanzas/movements?shared_file=${filename}`);
      // Use relative redirect or full URL if needed.
      // Hono redirect is relative to current path if not absolute?
      // Actually c.redirect works with absolute paths.
      // If frontend is on SAME domain (nginx proxy), relative is fine.
      return c.redirect(`/finanzas/movements?shared_file=${filename}`, 303);
    } catch (err) {
      console.error("[ShareTarget] Error:", err);
      return c.text("Error processing share", 500);
    }
  },
);
