import express from "express";
import { asyncHandler, requireRole } from "../lib/http.js";
import { listRoleMappings, upsertRoleMapping } from "../db.js";
import { z } from "zod";

const roleMappingSchema = z.object({
  employee_role: z.string().min(1).max(120),
  app_role: z.enum(["GOD", "ADMIN", "ANALYST", "VIEWER"]),
});

export function registerRoleRoutes(app: express.Express) {
  const router = express.Router();

  router.get("/mappings", asyncHandler(async (_req, res) => {
    const mappings = await listRoleMappings();
    res.json({ status: "ok", data: mappings });
  }));

  router.post("/mappings", requireRole("GOD", "ADMIN"), asyncHandler(async (req, res) => {
    const parsed = roleMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ status: "error", message: "Invalid data", issues: parsed.error.issues });
    }

    const { employee_role, app_role } = parsed.data;
    await upsertRoleMapping(employee_role, app_role);
    res.status(200).json({ status: "ok" });
  }));

  app.use("/api/roles", router);
}
