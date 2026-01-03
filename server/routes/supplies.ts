import express from "express";

import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import { supplyRequestSchema, updateSupplyRequestStatusSchema } from "../schemas/index.js";
import {
  createSupplyRequest,
  getCommonSupplies,
  getSupplyRequests,
  updateSupplyRequestStatus,
} from "../services/supplies.js";

export function registerSuppliesRoutes(app: express.Express) {
  const router = express.Router();

  router.get(
    "/requests",
    authorize("read", "SupplyRequest"),
    asyncHandler(async (req, res) => {
      const requests = await getSupplyRequests();
      res.json(requests);
    })
  );

  router.get(
    "/common",
    authorize("read", "SupplyRequest"),
    asyncHandler(async (req, res) => {
      const supplies = await getCommonSupplies();
      res.json(supplies);
    })
  );

  router.post(
    "/requests",
    authorize("create", "SupplyRequest"),
    asyncHandler(async (req, res) => {
      const parsed = supplyRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Datos inválidos", issues: parsed.error.issues });
      }

      await createSupplyRequest({
        userId: req.auth!.userId,
        ...parsed.data,
      });

      res.status(201).json({ status: "ok" });
    })
  );

  router.put(
    "/:id/status",
    authenticate,
    authorize("update", "SupplyRequest"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const parsed = updateSupplyRequestStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Estado inválido" });
      }

      await updateSupplyRequestStatus(id, parsed.data.status);
      res.json({ status: "ok" });
    })
  );

  app.use("/api/supplies", authenticate, router);
}
