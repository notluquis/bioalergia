import express, { Router } from "express";
import { z } from "zod";
import { getPool } from "../db.js";
import { SQLBuilder } from "../lib/database.js";
import { AuthenticatedRequest } from "../types.js";
import { authenticate, asyncHandler, requireRole } from "../lib/http.js";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const router = Router();

// Schemas
const supplyRequestSchema = z.object({
  supplyName: z.string().min(1, "Supply name is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  brand: z.string().optional(),
  model: z.string().optional(),
  notes: z.string().optional(),
});

const updateSupplyRequestStatusSchema = z.object({
  status: z.enum(["pending", "ordered", "in_transit", "delivered", "rejected"]),
  adminNotes: z.string().optional(),
});

const commonSupplySchema = z.object({
  name: z.string().min(1, "Common supply name is required"),
  brand: z.string().optional(),
  model: z.string().optional(),
  description: z.string().optional(),
});

// API Endpoints

// POST /api/supplies/requests - Create a new supply request
router.post(
  "/requests",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getPool();
    const { userId } = req.auth!;
    const { supplyName, quantity, brand, model, notes } = supplyRequestSchema.parse(req.body);

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO supply_requests (user_id, supply_name, quantity, brand, model, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, supplyName, quantity, brand || null, model || null, notes || null]
    );

    res.status(201).json({ id: result.insertId, message: "Supply request created successfully" });
  })
);

// GET /api/supplies/requests - Get all requests (admin) or user's requests (nurses/techs)
router.get(
  "/requests",
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getPool();
    const { role } = req.auth!;

    const builder = new SQLBuilder("supply_requests sr")
      .select("sr.*", "u.email as user_email")
      .join("users u", "sr.user_id = u.id");

    if (role !== "ADMIN" && role !== "GOD") {
      builder.where("sr.status IN ('pending', 'ordered', 'in_transit')");
    }

    builder.orderBy("sr.created_at", "DESC");

    const { sql: query, params } = builder.build();
    const [rows] = await db.execute<RowDataPacket[]>(query, params);

    res.json(rows);
  })
);

// PUT /api/supplies/requests/:id/status - Update request status (admin only)
router.put(
  "/requests/:id/status",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
    const db = getPool();
    const { id } = req.params;
    const { status, adminNotes } = updateSupplyRequestStatusSchema.parse(req.body);

    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE supply_requests SET status = ?, admin_notes = ? WHERE id = ?`,
      [status, adminNotes || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Supply request not found" });
    }

    res.json({ message: "Supply request status updated successfully" });
  })
);

// GET /api/supplies/common - Get common supply items
router.get(
  "/common",
  authenticate,
  asyncHandler(async (req, res) => {
    const db = getPool();
    const [rows] = await db.execute<RowDataPacket[]>(`SELECT * FROM common_supplies ORDER BY name ASC`);
    res.json(rows);
  })
);

// POST /api/supplies/common - Add a common supply item (admin only)
router.post(
  "/common",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req, res) => {
    const db = getPool();
    const { name, brand, model, description } = commonSupplySchema.parse(req.body);

    const [result] = await db.execute<ResultSetHeader>(
      `INSERT INTO common_supplies (name, brand, model, description)
       VALUES (?, ?, ?, ?)`,
      [name, brand || null, model || null, description || null]
    );

    res.status(201).json({ id: result.insertId, message: "Common supply added successfully" });
  })
);

// PUT /api/supplies/common/:id - Update a common supply item (admin only)
router.put(
  "/common/:id",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req, res) => {
    const db = getPool();
    const { id } = req.params;
    const { name, brand, model, description } = commonSupplySchema.parse(req.body);

    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE common_supplies SET name = ?, brand = ?, model = ?, description = ? WHERE id = ?`,
      [name, brand || null, model || null, description || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Common supply not found" });
    }

    res.json({ message: "Common supply updated successfully" });
  })
);

// DELETE /api/supplies/common/:id - Delete a common supply item (admin only)
router.delete(
  "/common/:id",
  authenticate,
  requireRole("ADMIN", "GOD"),
  asyncHandler(async (req, res) => {
    const db = getPool();
    const { id } = req.params;

    const [result] = await db.execute<ResultSetHeader>(
      `DELETE FROM common_supplies WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Common supply not found" });
    }

    res.json({ message: "El insumo común se ha eliminado correctamente" });
  })
);

export default router;
