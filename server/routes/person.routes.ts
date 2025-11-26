import { Router } from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import { authenticate as requireAuth, requireRole } from "../lib/http.js";
import type { AuthenticatedRequest } from "../types.js";
import { logAudit } from "../services/audit.js";

const router = Router();

// Schema for creating/updating a person
const personSchema = z.object({
  rut: z.string().min(8),
  names: z.string().min(2),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  personType: z.enum(["NATURAL", "JURIDICAL"]).default("NATURAL"),
});

// GET /api/people - List all people
router.get("/", requireAuth, async (req, res) => {
  try {
    const people = await prisma.person.findMany({
      include: {
        user: { select: { id: true, email: true, role: true, status: true } },
        employee: { select: { id: true, position: true, status: true } },
        counterpart: { select: { id: true, category: true } },
      },
      orderBy: { names: "asc" },
    });
    res.json(people);
  } catch (error) {
    console.error("Error fetching people:", error);
    res.status(500).json({ error: "Failed to fetch people" });
  }
});

// GET /api/people/:id - Get single person details
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        user: true,
        employee: true,
        counterpart: true,
        transactions: { take: 10, orderBy: { timestamp: "desc" } },
      },
    });
    if (!person) return res.status(404).json({ error: "Person not found" });
    res.json(person);
  } catch {
    res.status(500).json({ error: "Failed to fetch person" });
  }
});

// POST /api/people - Create new person
router.post("/", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const data = personSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;

    // Check for existing RUT
    const existing = await prisma.person.findUnique({ where: { rut: data.rut } });
    if (existing) return res.status(400).json({ error: "RUT already exists" });

    const person = await prisma.person.create({ data });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "PERSON_CREATE",
      entity: "Person",
      entityId: person.id,
      details: { rut: data.rut, names: data.names },
      ipAddress: req.ip,
    });

    res.json(person);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues });
    res.status(500).json({ error: "Failed to create person" });
  }
});

// PUT /api/people/:id - Update person
router.put("/:id", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const data = personSchema.partial().parse(req.body);
    const authReq = req as AuthenticatedRequest;
    const targetPersonId = Number(req.params.id);

    const person = await prisma.person.update({
      where: { id: targetPersonId },
      data,
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "PERSON_UPDATE",
      entity: "Person",
      entityId: targetPersonId,
      details: data,
      ipAddress: req.ip,
    });

    res.json(person);
  } catch {
    res.status(500).json({ error: "Failed to update person" });
  }
});

export default router;
