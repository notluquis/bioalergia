import express from "express";
import { asyncHandler, authenticate } from "../lib/http.js";
import { authorize } from "../middleware/authorize.js";
import {
  getSupplyRequests,
  getCommonSupplies,
  createSupplyRequest,
  updateSupplyRequestStatus,
} from "../services/supplies.js";
import { z } from "zod";

const createSupplyRequestSchema = z.object({
  supplyName: z.string().min(1),
  quantity: z.number().int().positive(),
  brand: z.string().optional(),
  model: z.string().optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "FULFILLED"]),
});

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
      const parsed = createSupplyRequestSchema.safeParse(req.body);
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
    "/requests/:id/status",
    authorize("manage", "SupplyRequest"),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: "error", message: "Estado inválido" });
      }

      await updateSupplyRequestStatus(id, parsed.data.status);
      res.json({ status: "ok" });
    })
  );

  app.use("/api/supplies", authenticate, router);
}
