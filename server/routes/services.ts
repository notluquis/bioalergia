import express from "express";
import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";

import { logEvent, requestContext } from "../lib/logger.js";
import { createService, getServiceById, listServices, updateService, deleteService } from "../services/services.js";
import type { AuthenticatedRequest } from "../types.js";
import { serviceCreateSchema } from "../schemas/index.js";

import { mapService } from "../lib/mappers.js";
import { ServiceType, ServiceFrequency } from "@prisma/client";

export function registerServiceRoutes(app: express.Express) {
  const router = express.Router();

  router.get(
    "/",
    authenticate,
    authorize("read", "Service"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const services = await listServices(req.ability);
      res.json({
        status: "ok",
        services: services.map((s) => ({
          ...mapService(s),
        })),
      });
    })
  );

  router.post(
    "/",
    authenticate,
    authorize("create", "Service"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsed = serviceCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }
      logEvent("services:create", requestContext(req, parsed.data));
      const service = await createService({
        name: parsed.data.name,
        type: parsed.data.serviceType as ServiceType,
        frequency: parsed.data.frequency as ServiceFrequency,
        defaultAmount: parsed.data.defaultAmount,
        counterpartId: parsed.data.counterpartId ?? null,
        status: "ACTIVE",
      });

      res.json({
        status: "ok",
        service: mapService(service),
      });
    })
  );

  router.put(
    "/:id",
    authenticate,
    authorize("update", "Service"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      const parsed = serviceCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }
      logEvent("services:update", requestContext(req, { id, body: parsed.data }));

      const service = await updateService(id, {
        name: parsed.data.name,
        type: parsed.data.serviceType as ServiceType,
        frequency: parsed.data.frequency as ServiceFrequency,
        defaultAmount: parsed.data.defaultAmount,
        counterpartId: parsed.data.counterpartId ?? null,
      });

      res.json({
        status: "ok",
        service: mapService(service),
      });
    })
  );

  router.get(
    "/:id",
    authenticate,
    authorize("read", "Service"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      const service = await getServiceById(id);
      if (!service) {
        return res.status(404).json({ status: "error", message: "Servicio no encontrado" });
      }
      res.json({
        status: "ok",
        service: mapService(service),
      });
    })
  );

  router.delete(
    "/:id",
    authenticate,
    authorize("delete", "Service"),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ status: "error", message: "ID inválido" });
      }
      await deleteService(id);
      res.json({ status: "ok" });
    })
  );

  app.use("/api/services", router);
}
