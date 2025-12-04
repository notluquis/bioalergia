import { Router } from "express";
import { prisma } from "../prisma.js";
import { z } from "zod";
import { authenticate as requireAuth, requireRole } from "../lib/http.js";
import type { AuthenticatedRequest } from "../types.js";
import { logAudit } from "../services/audit.js";
import { mapPerson, type PersonWithRoles } from "../lib/mappers.js";

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

// Include all roles when fetching people
const personInclude = {
  user: { select: { id: true, email: true, role: true, status: true } },
  employee: true,
  counterpart: { include: { accounts: true } },
} as const;

// GET /api/people - List all people with their roles
router.get("/", requireAuth, async (req, res) => {
  try {
    const people = await prisma.person.findMany({
      include: personInclude,
      orderBy: { names: "asc" },
    });
    res.json({
      status: "ok",
      people: people.map((p) => mapPerson(p as PersonWithRoles)),
    });
  } catch (error) {
    console.error("Error fetching people:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch people" });
  }
});

// GET /api/people/:id - Get single person with all roles
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) return res.status(400).json({ status: "error", message: "Invalid ID" });

    const person = await prisma.person.findUnique({
      where: { id },
      include: {
        ...personInclude,
        transactions: { take: 10, orderBy: { timestamp: "desc" } },
      },
    });
    if (!person) return res.status(404).json({ status: "error", message: "Person not found" });

    res.json({
      status: "ok",
      person: mapPerson(person as PersonWithRoles),
      transactions: person.transactions,
    });
  } catch (error) {
    console.error("Error fetching person:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch person" });
  }
});

// GET /api/people/rut/:rut - Get person by RUT
router.get("/rut/:rut", requireAuth, async (req, res) => {
  try {
    const rut = req.params.rut;
    const person = await prisma.person.findUnique({
      where: { rut },
      include: personInclude,
    });
    if (!person) return res.status(404).json({ status: "error", message: "Person not found" });

    res.json({
      status: "ok",
      person: mapPerson(person as PersonWithRoles),
    });
  } catch (error) {
    console.error("Error fetching person by RUT:", error);
    res.status(500).json({ status: "error", message: "Failed to fetch person" });
  }
});

// POST /api/people - Create new person
router.post("/", requireAuth, requireRole("ADMIN", "GOD"), async (req, res) => {
  try {
    const data = personSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;

    // Check for existing RUT
    const existing = await prisma.person.findUnique({ where: { rut: data.rut } });
    if (existing) return res.status(400).json({ status: "error", message: "RUT already exists" });

    const person = await prisma.person.create({
      data,
      include: personInclude,
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "PERSON_CREATE",
      entity: "Person",
      entityId: person.id,
      details: { rut: data.rut, names: data.names },
      ipAddress: req.ip,
    });

    res.json({ status: "ok", person: mapPerson(person as PersonWithRoles) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ status: "error", issues: error.issues });
    res.status(500).json({ status: "error", message: "Failed to create person" });
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
      include: personInclude,
    });

    await logAudit({
      userId: authReq.auth!.userId,
      action: "PERSON_UPDATE",
      entity: "Person",
      entityId: targetPersonId,
      details: data,
      ipAddress: req.ip,
    });

    res.json({ status: "ok", person: mapPerson(person as PersonWithRoles) });
  } catch {
    res.status(500).json({ status: "error", message: "Failed to update person" });
  }
});

export default router;
