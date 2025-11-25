import express, { Router } from "express";

import { AuthenticatedRequest } from "../types.js";
import { Prisma } from "../../generated/prisma/client.js";
import { authenticate, asyncHandler, requireRole } from "../lib/http.js";
import {
  createSupplyRequest,
  listSupplyRequests,
  updateSupplyRequestStatus,
  listCommonSupplies,
  createCommonSupply,
  updateCommonSupply,
  deleteCommonSupply,
} from "../services/supplies.js";

const router = Router();

// Schemas
import { supplyRequestSchema, updateSupplyRequestStatusSchema, commonSupplySchema } from "../schemas.js";

// API Endpoints

// POST /api/supplies/requests - Create a new supply request
router.post(
  "/requests",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { userId } = req.auth!;
    const { supplyName, quantity, brand, model, notes } = supplyRequestSchema.parse(req.body);

    const request = await createSupplyRequest({
      userId,
      supplyName,
      quantity,
      brand: brand || null,
      model: model || null,
      notes: notes || null,
    });

    res.status(201).json({ id: request.id, message: "Supply request created successfully" });
  })
);

// GET /api/supplies/requests - Get all requests (admin) or user's requests (nurses/techs)
router.get(
  "/requests",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { role } = req.auth!;
    const requests = await listSupplyRequests({ role });

    // Map to match the expected response format
    const rows = requests.map(
      (r: Prisma.SupplyRequestGetPayload<{ include: { user: { select: { email: true } } } }>) => ({
        ...r,
        user_email: r.user.email,
      })
    );

    res.json(rows);
  })
);

// PUT /api/supplies/requests/:id/status - Update request status (admin only)
router.put(
  "/requests/:id/status",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const { id } = req.params;
    const { status, adminNotes } = updateSupplyRequestStatusSchema.parse(req.body);

    try {
      await updateSupplyRequestStatus(Number(id), status, adminNotes || null);
      res.json({ message: "Supply request status updated successfully" });
    } catch {
      res.status(500).json({ status: "error", message: "Failed to update request status" });
    }
  })
);

// GET /api/supplies/common - Get common supply items
router.get(
  "/common",
  authenticate,
  asyncHandler(async (req, res) => {
    const supplies = await listCommonSupplies();
    res.json(supplies);
  })
);

// POST /api/supplies/common - Add a common supply item (admin only)
router.post(
  "/common",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req, res) => {
    const { name, brand, model, description } = commonSupplySchema.parse(req.body);

    const supply = await createCommonSupply({
      name,
      brand: brand || null,
      model: model || null,
      description: description || null,
    });

    res.status(201).json({ id: supply.id, message: "Common supply added successfully" });
  })
);

// PUT /api/supplies/common/:id - Update a common supply item (admin only)
router.put(
  "/common/:id",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, brand, model, description } = commonSupplySchema.parse(req.body);

    try {
      await updateCommonSupply(Number(id), {
        name,
        brand: brand || null,
        model: model || null,
        description: description || null,
      });
      res.json({ message: "Common supply updated successfully" });
    } catch {
      return res.status(404).json({ message: "Common supply not found" });
    }
  })
);

// DELETE /api/supplies/common/:id - Delete a common supply item (admin only)
router.delete(
  "/common/:id",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      await deleteCommonSupply(Number(id));
      res.json({ message: "El insumo común se ha eliminado correctamente" });
    } catch {
      return res.status(404).json({ message: "Common supply not found" });
    }
  })
);

export default router;
