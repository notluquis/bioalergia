import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { db } from "@finanzas/db";
import { createPatientSchema, updatePatientSchema, createConsultationSchema, createBudgetSchema, createPaymentSchema, createAttachmentSchema } from "./patients.schema.js";
import { getSessionUser } from "../../auth.js";

type Variables = {
  // biome-ignore lint/suspicious/noExplicitAny: legacy typing
  user: any;
};

const patientsRoutes = new Hono<{ Variables: Variables }>();

// GET / - List patients with search
patientsRoutes.get("/", async (c) => {
  const { q } = c.req.query();
  
  const where: any = {};
  
  if (q) {
    where.person = {
      OR: [
        { names: { contains: q, mode: "insensitive" } },
        { fatherName: { contains: q, mode: "insensitive" } },
        { motherName: { contains: q, mode: "insensitive" } },
        { rut: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  try {
    const patients = await db.patient.findMany({
      where,
      include: {
        person: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 50,
    });

    return c.json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    return c.json({ error: "Error al buscar pacientes" }, 500);
  }
});

// GET /:id - Get patient details
patientsRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  
  if (Number.isNaN(id)) {
    return c.json({ error: "ID inválido" }, 400);
  }

  try {
    const patient = await db.patient.findUnique({
      where: { id },
      include: {
        person: true,
        consultations: {
          orderBy: { date: "desc" },
          take: 10,
        },
        medicalCertificates: {
          orderBy: { issuedAt: "desc" },
          take: 10,
        },
        budgets: {
          orderBy: { updatedAt: "desc" },
          include: { items: true },
        },
        payments: {
          orderBy: { paymentDate: "desc" },
        },
        attachments: {
          orderBy: { uploadedAt: "desc" },
        },
      },
    });

    if (!patient) {
      return c.json({ error: "Paciente no encontrado" }, 404);
    }

    return c.json(patient);
  } catch (error) {
    console.error("Error fetching patient:", error);
    return c.json({ error: "Error al obtener paciente" }, 500);
  }
});

// POST / - Create patient
patientsRoutes.post("/", zValidator("json", createPatientSchema), async (c) => {
  const input = c.req.valid("json");
  // const user = c.get("user"); // TODO: Validate auth
  try {
    // 1. Check if person exists by RUT
    let person = await db.person.findUnique({
      where: { rut: input.rut },
    });

    if (person) {
      // Check if already a patient
      const existingPatient = await db.patient.findUnique({
        where: { personId: person.id },
      });

      if (existingPatient) {
        return c.json({ error: "El paciente ya está registrado" }, 409);
      }

      // Update person details if provided
      person = await db.person.update({
        where: { id: person.id },
        data: {
          names: input.names,
          fatherName: input.fatherName,
          motherName: input.motherName,
          email: input.email || person.email,
          phone: input.phone || person.phone,
          address: input.address || person.address,
        },
      });
    } else {
      // Create new person
      person = await db.person.create({
        data: {
          rut: input.rut,
          names: input.names,
          fatherName: input.fatherName,
          motherName: input.motherName,
          email: input.email,
          phone: input.phone,
          address: input.address,
        },
      });
    }

    // 2. Create patient profile
    const patient = await db.patient.create({
      data: {
        personId: person.id,
        birthDate: new Date(input.birthDate),
        bloodType: input.bloodType,
        notes: input.notes,
      },
      include: {
        person: true,
      },
    });

    return c.json(patient, 201);
  } catch (error) {
    console.error("Error creating patient:", error);
    return c.json({ error: "Error al crear paciente", details: String(error) }, 500);
  }
});

// PUT /:id - Update patient
patientsRoutes.put("/:id", zValidator("json", updatePatientSchema), async (c) => {
  const id = Number(c.req.param("id"));
  const input = c.req.valid("json");

  if (Number.isNaN(id)) {
    return c.json({ error: "ID inválido" }, 400);
  }

  try {
    const patient = await db.patient.findUnique({
      where: { id },
      include: { person: true },
    });

    if (!patient) {
      return c.json({ error: "Paciente no encontrado" }, 404);
    }

    // Update person if person fields are provided
    if (
      input.names ||
      input.fatherName ||
      input.motherName ||
      input.email !== undefined ||
      input.phone ||
      input.address ||
      input.rut
    ) {
      await db.person.update({
        where: { id: patient.personId },
        data: {
          rut: input.rut,
          names: input.names,
          fatherName: input.fatherName,
          motherName: input.motherName,
          email: input.email,
          phone: input.phone,
          address: input.address,
        },
      });
    }

    // Update patient fields
    const updatedPatient = await db.patient.update({
      where: { id },
      data: {
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        bloodType: input.bloodType,
        notes: input.notes,
      },
      include: {
        person: true,
      },
    });

    return c.json(updatedPatient);
  } catch (error) {
    console.error("Error updating patient:", error);
    return c.json({ error: "Error al actualizar paciente" }, 500);
  }
});

// POST /:id/consultations - Create consultation for patient
patientsRoutes.post("/:id/consultations", zValidator("json", createConsultationSchema), async (c) => {
  const patientId = Number(c.req.param("id"));
  const input = c.req.valid("json");

  if (Number.isNaN(patientId)) {
    return c.json({ error: "ID de paciente inválido" }, 400);
  }

  try {
    const patient = await db.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return c.json({ error: "Paciente no encontrado" }, 404);
    }

    const consultation = await db.consultation.create({
      data: {
        patientId,
        date: new Date(input.date),
        reason: input.reason,
        diagnosis: input.diagnosis,
        treatment: input.treatment,
        notes: input.notes,
        eventId: input.eventId,
      },
    });

    return c.json(consultation, 201);
  } catch (error) {
    console.error("Error creating consultation:", error);
    return c.json({ error: "Error al registrar la consulta", details: String(error) }, 500);
  }
});

// POST /:id/budgets - Create budget for patient
patientsRoutes.post("/:id/budgets", zValidator("json", createBudgetSchema), async (c) => {
  const patientId = Number(c.req.param("id"));
  const input = c.req.valid("json");

  try {
    const totalAmount = input.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const finalAmount = totalAmount - input.discount;

    const budget = await db.budget.create({
      data: {
        patientId,
        title: input.title,
        totalAmount,
        discount: input.discount,
        finalAmount,
        notes: input.notes,
        items: {
          create: input.items.map(item => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    return c.json(budget, 201);
  } catch {
    console.error("Error creating budget:");
    return c.json({ error: "Error al crear el presupuesto" }, 500);
  }
});

// GET /:id/budgets - List patient budgets
patientsRoutes.get("/:id/budgets", async (c) => {
  const patientId = Number(c.req.param("id"));
  try {
    const budgets = await db.budget.findMany({
      where: { patientId },
      include: { items: true, payments: true },
      orderBy: { updatedAt: "desc" },
    });
    return c.json(budgets);
  } catch {
    return c.json({ error: "Error al obtener presupuestos" }, 500);
  }
});

// POST /:id/payments - Register payment for patient
patientsRoutes.post("/:id/payments", zValidator("json", createPaymentSchema), async (c) => {
  const patientId = Number(c.req.param("id"));
  const input = c.req.valid("json");

  try {
    const payment = await db.patientPayment.create({
      data: {
        patientId,
        budgetId: input.budgetId,
        amount: input.amount,
        paymentDate: new Date(input.paymentDate),
        paymentMethod: input.paymentMethod,
        reference: input.reference,
        notes: input.notes,
      },
    });

    return c.json(payment, 201);
  } catch {
    console.error("Error registering payment:");
    return c.json({ error: "Error al registrar pago" }, 500);
  }
});

// GET /:id/payments - List patient payments
patientsRoutes.get("/:id/payments", async (c) => {
  const patientId = Number(c.req.param("id"));
  try {
    const payments = await db.patientPayment.findMany({
      where: { patientId },
      orderBy: { paymentDate: "desc" },
    });
    return c.json(payments);
  } catch {
    return c.json({ error: "Error al obtener pagos" }, 500);
  }
});

// POST /:id/attachments - Add attachment
patientsRoutes.post("/:id/attachments", zValidator("json", createAttachmentSchema), async (c) => {
  const patientId = Number(c.req.param("id"));
  const input = c.req.valid("json");
  const user = await getSessionUser(c);

  if (!user?.id) {
    return c.json({ error: "No autorizado" }, 401);
  }

  try {
    const attachment = await db.patientAttachment.create({
      data: {
        patientId,
        name: input.name,
        type: input.type,
        driveFileId: input.driveFileId,
        mimeType: input.mimeType,
        uploadedBy: user.id,
      },
    });

    return c.json(attachment, 201);
  } catch {
    console.error("Error creating attachment:");
    return c.json({ error: "Error al guardar adjunto" }, 500);
  }
});

// GET /:id/attachments - List attachments
patientsRoutes.get("/:id/attachments", async (c) => {
  const patientId = Number(c.req.param("id"));
  try {
    const attachments = await db.patientAttachment.findMany({
      where: { patientId },
      orderBy: { uploadedAt: "desc" },
    });
    return c.json(attachments);
  } catch {
    return c.json({ error: "Error al obtener adjuntos" }, 500);
  }
});

export default patientsRoutes;
