import express from "express";
import { asyncHandler, authenticate, requireRole } from "../lib/http.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { listEmployees, createEmployee, updateEmployee, deactivateEmployee } from "../repositories/employees.js";
import { employeeSchema, employeeUpdateSchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";

export function registerEmployeeRoutes(app: express.Express) {
  app.get(
    "/api/employees",
    authenticate,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const includeInactive = req.query.includeInactive === "true";
      const employees = await listEmployees({ includeInactive });
      logEvent("employees:list", requestContext(req, { count: employees.length }));
      res.json({ status: "ok", employees });
    })
  );

  app.post(
    "/api/employees",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = employeeSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("employees:create:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }

      const employee = await createEmployee(parsed.data);
      logEvent("employees:create", requestContext(req, { employeeId: employee?.id }));
      res.status(201).json({ status: "ok", employee });
    })
  );

  app.put(
    "/api/employees/:id",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = employeeUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("employees:update:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }

      const employeeId = Number(req.params.id);
      const employee = await updateEmployee(employeeId, parsed.data);
      logEvent("employees:update", requestContext(req, { employeeId }));
      res.json({ status: "ok", employee });
    })
  );

  app.delete(
    "/api/employees/:id",
    authenticate,
    requireRole("GOD", "ADMIN"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const employeeId = Number(req.params.id);
      await deactivateEmployee(employeeId);
      logEvent("employees:deactivate", requestContext(req, { employeeId }));
      res.json({ status: "ok" });
    })
  );
}
