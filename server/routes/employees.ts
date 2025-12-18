import express from "express";
import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import { logEvent, logWarn, requestContext } from "../lib/logger.js";
import { listEmployees, createEmployee, updateEmployee, deactivateEmployee } from "../services/employees.js";
import { employeeSchema, employeeUpdateSchema } from "../schemas.js";
import type { AuthenticatedRequest } from "../types.js";
import { mapEmployee } from "../lib/mappers.js";

export function registerEmployeeRoutes(app: express.Express) {
  app.get(
    "/api/employees",
    authenticate,
    authorize("read", "Employee"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const includeInactive = req.query.includeInactive === "true";
      const includeTest = req.query.includeTest === "true";
      const employees = await listEmployees({ includeInactive, includeTest });
      const mapped = employees.map(mapEmployee);
      logEvent("employees:list", requestContext(req, { count: employees.length }));
      res.json({ status: "ok", employees: mapped });
    })
  );

  app.post(
    "/api/employees",
    authenticate,
    authorize("manage", "Employee"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = employeeSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("employees:create:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res
          .status(400)
          .json({ status: "error", message: "Los datos no son válidos", issues: parsed.error.issues });
      }

      // Validate required fields for creation
      if (!parsed.data.rut) {
        return res.status(400).json({ status: "error", message: "El RUT es requerido para crear un empleado" });
      }

      const employee = await createEmployee({
        ...parsed.data,
        rut: parsed.data.rut,
        full_name: parsed.data.full_name,
      });
      logEvent("employees:create", requestContext(req, { employeeId: employee?.id }));
      res.status(201).json({ status: "ok", employee: mapEmployee(employee) });
    })
  );

  app.put(
    "/api/employees/:id",
    authenticate,
    authorize("manage", "Employee"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = employeeUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        logWarn("employees:update:invalid", requestContext(req, { issues: parsed.error.issues }));
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }

      const employeeId = Number(req.params.id);
      const employee = await updateEmployee(employeeId, parsed.data);
      logEvent("employees:update", requestContext(req, { employeeId }));
      res.json({ status: "ok", employee: mapEmployee(employee) });
    })
  );

  app.delete(
    "/api/employees/:id",
    authenticate,
    authorize("manage", "Employee"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const employeeId = Number(req.params.id);
      await deactivateEmployee(employeeId);
      logEvent("employees:deactivate", requestContext(req, { employeeId }));
      res.json({ status: "ok" });
    })
  );
}
