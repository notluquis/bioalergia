import { Hono } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { getIcd11Token } from "../services/icd11.ts";

export const icd11TokenRoutes = new Hono();

// GET /api/icd11/token
//
// Entrega un access_token del WHO ICD-11 (CIE-11) cloud API al ECT widget
// (`getNewTokenFunction`). El client_secret vive solo en el server; el browser
// nunca lo ve. Gateado por sesión + permiso de crear recetas/certificados.
icd11TokenRoutes.get("/token", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "create", "MedicalCertificate"))) {
    return c.text("Forbidden", 403);
  }

  try {
    const token = await getIcd11Token();
    // No cacheable en el browser: el widget pide on-demand y el server ya
    // cachea en memoria hasta el expiry real.
    c.header("Cache-Control", "no-store");
    return c.json({ token });
  } catch (error) {
    logError("icd11.token", error);
    return c.text("ICD-11 token unavailable", 502);
  }
});
