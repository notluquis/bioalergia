// Serve the WhatsApp-Flow intake receipt (a payment comprobante = PHI) through
// an AUTHENTICATED stream instead of a public R2 CDN url. Same gate as the intake
// viewer (read WaBusinessAccount), mirroring routes/wa-cloud-media.ts.

import { db } from "@finanzas/db";
import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { getR2Object } from "../modules/cloudflare/r2.ts";

export const intakeMediaRoutes = new Hono();

intakeMediaRoutes.get("/comprobante/:id", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "read", "WaBusinessAccount"))) {
    return c.text("Forbidden", 403);
  }
  const intake = await db.intakeSubmission.findUnique({
    where: { id: c.req.param("id") },
    select: { comprobanteR2Key: true, comprobanteMime: true },
  });
  if (!intake?.comprobanteR2Key) return c.text("Not found", 404);

  const obj = await getR2Object(intake.comprobanteR2Key);
  c.header("Content-Type", intake.comprobanteMime ?? obj.contentType);
  c.header("Cache-Control", "private, no-store");
  return c.body(obj.body);
});
