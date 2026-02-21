import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AttachmentType, User } from "@finanzas/db";
import { db } from "@finanzas/db";
import type { PatientWhereInput } from "@finanzas/db/input";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import { Decimal } from "decimal.js";
import { Hono } from "hono";
import { sql } from "kysely";
import { getSessionUser } from "../../auth.js";
import { normalizeRut } from "../../lib/rut.js";
import { zValidator } from "../../lib/zod-validator";
import { uploadPatientAttachmentToDrive } from "../../services/patient-attachments-drive.js";
import { replyRaw } from "../../utils/reply";
import {
  createBudgetSchema,
  createConsultationSchema,
  createPatientSchema,
  createPaymentSchema,
  listDtePatientSourcesQuerySchema,
  syncPatientsFromDteSalesSchema,
  updatePatientSchema,
} from "./patients.schema.js";

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";
const parseDateOnly = (value: string) => dayjs.tz(value, "YYYY-MM-DD", TIMEZONE).toDate();
const withBudgetItems = <T extends { budgets?: unknown[] }>(payload: T): T => {
  if (!Array.isArray(payload.budgets)) {
    return payload;
  }
  const budgets = payload.budgets.map((budget) => ({
    ...(budget as Record<string, unknown>),
    items: [],
  }));
  return { ...payload, budgets } as T;
};

type Variables = {
  user: User;
};

type DteSalesSyncOptions = {
  dryRun: boolean;
  documentTypes?: number[];
  limit?: number;
  period?: string;
};

type NormalizedDteClientRow = {
  clientName: string;
  clientRUT: string;
  documentDate: Date | null;
  documentType: number;
  folio: string | null;
  period: string | null;
  sourceUpdatedAt: Date | null;
};

const patientsRoutes = new Hono<{ Variables: Variables }>();

const normalizeSourceRut = (value: string) => {
  const normalized = normalizeRut(value);
  if (normalized) {
    return normalized;
  }
  return value.trim().toUpperCase();
};

function buildDteLatestClientQuery(options: Omit<DteSalesSyncOptions, "dryRun">) {
  let rankedQuery = db.$qb
    .selectFrom("DTESaleDetail as s")
    .select([
      "s.clientRUT as clientRUT",
      "s.clientName as clientName",
      "s.documentType as documentType",
      "s.documentDate as documentDate",
      "s.folio as folio",
      "s.period as period",
      "s.updatedAt as sourceUpdatedAt",
      sql<number>`
        row_number() over (
          partition by s.client_rut
          order by s.document_date desc, s.updated_at desc, s.id desc
        )
      `.as("rank"),
    ])
    .where("s.clientRUT", "<>", "")
    .where("s.clientName", "<>", "");

  if (options.period) {
    rankedQuery = rankedQuery.where("s.period", "=", options.period);
  }

  if (options.documentTypes && options.documentTypes.length > 0) {
    rankedQuery = rankedQuery.where("s.documentType", "in", options.documentTypes);
  }

  let latestQuery = db.$qb
    .selectFrom(rankedQuery.as("ranked"))
    .select([
      "ranked.clientRUT",
      "ranked.clientName",
      "ranked.documentType",
      "ranked.documentDate",
      "ranked.folio",
      "ranked.period",
      "ranked.sourceUpdatedAt",
    ])
    .where("ranked.rank", "=", 1)
    .orderBy("ranked.clientRUT", "asc");

  if (options.limit) {
    latestQuery = latestQuery.limit(options.limit);
  }

  return latestQuery;
}

function normalizeDteClientRows(
  rows: Awaited<ReturnType<ReturnType<typeof buildDteLatestClientQuery>["execute"]>>,
): NormalizedDteClientRow[] {
  return rows
    .map((row) => ({
      clientRUT: normalizeSourceRut(String(row.clientRUT || "")),
      clientName: String(row.clientName || "").trim(),
      documentType: Number(row.documentType),
      documentDate: row.documentDate ? new Date(row.documentDate) : null,
      folio: row.folio ? String(row.folio) : null,
      period: row.period ? String(row.period) : null,
      sourceUpdatedAt: row.sourceUpdatedAt ? new Date(row.sourceUpdatedAt) : null,
    }))
    .filter((row) => row.clientRUT.length > 0 && row.clientName.length > 0);
}

function hasSourceChanges(
  existing: {
    clientName: string;
    documentDate: Date | null;
    documentType: number;
    folio: string | null;
    period: string | null;
    sourceUpdatedAt: Date | null;
  },
  nextData: Omit<NormalizedDteClientRow, "clientRUT">,
) {
  return (
    existing.clientName !== nextData.clientName ||
    existing.documentType !== nextData.documentType ||
    String(existing.documentDate || "") !== String(nextData.documentDate || "") ||
    String(existing.folio || "") !== String(nextData.folio || "") ||
    String(existing.period || "") !== String(nextData.period || "") ||
    String(existing.sourceUpdatedAt || "") !== String(nextData.sourceUpdatedAt || "")
  );
}

async function syncPatientDteSaleSources(options: DteSalesSyncOptions) {
  const latestRows = await buildDteLatestClientQuery(options).execute();
  const normalizedRows = normalizeDteClientRows(latestRows);

  if (normalizedRows.length === 0) {
    return {
      dryRun: options.dryRun,
      inserted: 0,
      message: "No se encontraron clientes válidos en DTE sales para sincronizar",
      selected: 0,
      skipped: 0,
      updated: 0,
    };
  }

  const existingRows = await db.patientDteSaleSource.findMany({
    where: {
      clientRUT: {
        in: normalizedRows.map((row) => row.clientRUT),
      },
    },
  });

  const existingByRut = new Map(existingRows.map((row) => [row.clientRUT, row]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of normalizedRows) {
    const existing = existingByRut.get(row.clientRUT);
    const nextData = {
      clientName: row.clientName,
      documentDate: row.documentDate,
      documentType: row.documentType,
      folio: row.folio,
      period: row.period,
      sourceUpdatedAt: row.sourceUpdatedAt,
    };

    if (!existing) {
      inserted += 1;
      if (!options.dryRun) {
        await db.patientDteSaleSource.create({
          data: {
            clientRUT: row.clientRUT,
            ...nextData,
          },
        });
      }
      continue;
    }

    if (!hasSourceChanges(existing, nextData)) {
      skipped += 1;
      continue;
    }

    updated += 1;
    if (!options.dryRun) {
      await db.patientDteSaleSource.update({
        where: { clientRUT: row.clientRUT },
        data: nextData,
      });
    }
  }

  return {
    dryRun: options.dryRun,
    inserted,
    message: options.dryRun
      ? "Dry run completado para sincronización de pacientes desde DTE sales"
      : "Sincronización de pacientes desde DTE sales completada",
    selected: normalizedRows.length,
    skipped,
    updated,
  };
}

// GET / - List patients with search
patientsRoutes.get("/", async (c) => {
  const { q } = c.req.query();

  // Build where clause using type-safe PatientWhereInput
  const where: PatientWhereInput = q
    ? {
        person: {
          OR: [
            { names: { contains: q, mode: "insensitive" } },
            { fatherName: { contains: q, mode: "insensitive" } },
            { motherName: { contains: q, mode: "insensitive" } },
            { rut: { contains: q, mode: "insensitive" } },
          ],
        },
      }
    : {};

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

    return replyRaw(c, patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    return replyRaw(c, { error: "Error al buscar pacientes" }, 500);
  }
});

// GET /sources/dte - List DTE-derived patient source rows
patientsRoutes.get(
  "/sources/dte",
  zValidator("query", listDtePatientSourcesQuerySchema),
  async (c) => {
    const { q, period, limit } = c.req.valid("query");
    const maxRows = Math.min(limit || 100, 1000);

    try {
      const rows = await db.patientDteSaleSource.findMany({
        where: {
          AND: [
            period ? { period } : {},
            q
              ? {
                  OR: [
                    { clientRUT: { contains: q, mode: "insensitive" } },
                    { clientName: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ updatedAt: "desc" }],
        take: maxRows,
      });

      return replyRaw(c, rows);
    } catch (error) {
      console.error("Error listing DTE patient sources:", error);
      return replyRaw(c, { error: "Error al listar fuentes DTE de pacientes" }, 500);
    }
  },
);

// POST /sources/dte/sync - Materialize patients source from DTE sales
patientsRoutes.post(
  "/sources/dte/sync",
  zValidator("json", syncPatientsFromDteSalesSchema),
  async (c) => {
    const options = c.req.valid("json");

    try {
      const result = await syncPatientDteSaleSources(options);
      return replyRaw(c, result);
    } catch (error) {
      console.error("Error syncing DTE patient sources:", error);
      return replyRaw(
        c,
        {
          error: "Error al sincronizar base de pacientes desde DTE sales",
          details: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// GET /:id - Get patient details
patientsRoutes.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));

  if (Number.isNaN(id)) {
    return replyRaw(c, { error: "ID inválido" }, 400);
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
      return replyRaw(c, { error: "Paciente no encontrado" }, 404);
    }

    return replyRaw(c, withBudgetItems(patient));
  } catch (error) {
    console.error("Error fetching patient:", error);
    return replyRaw(c, { error: "Error al obtener paciente" }, 500);
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
        return replyRaw(c, { error: "El paciente ya está registrado" }, 409);
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
        birthDate: input.birthDate ? parseDateOnly(input.birthDate) : null,
        bloodType: input.bloodType,
        notes: input.notes,
      },
      include: {
        person: true,
      },
    });

    return replyRaw(c, patient, 201);
  } catch (error) {
    console.error("Error creating patient:", error);
    return replyRaw(c, { error: "Error al crear paciente", details: String(error) }, 500);
  }
});

// PUT /:id - Update patient
patientsRoutes.put("/:id", zValidator("json", updatePatientSchema), async (c) => {
  const id = Number(c.req.param("id"));
  const input = c.req.valid("json");

  if (Number.isNaN(id)) {
    return replyRaw(c, { error: "ID inválido" }, 400);
  }

  try {
    const patient = await db.patient.findUnique({
      where: { id },
      include: { person: true },
    });

    if (!patient) {
      return replyRaw(c, { error: "Paciente no encontrado" }, 404);
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
        birthDate:
          input.birthDate === null
            ? null
            : input.birthDate
              ? parseDateOnly(input.birthDate)
              : undefined,
        bloodType: input.bloodType,
        notes: input.notes,
      },
      include: {
        person: true,
      },
    });

    return replyRaw(c, updatedPatient);
  } catch (error) {
    console.error("Error updating patient:", error);
    return replyRaw(c, { error: "Error al actualizar paciente" }, 500);
  }
});

// POST /:id/consultations - Create consultation for patient
patientsRoutes.post(
  "/:id/consultations",
  zValidator("json", createConsultationSchema),
  async (c) => {
    const patientId = Number(c.req.param("id"));
    const input = c.req.valid("json");

    if (Number.isNaN(patientId)) {
      return replyRaw(c, { error: "ID de paciente inválido" }, 400);
    }

    try {
      const patient = await db.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        return replyRaw(c, { error: "Paciente no encontrado" }, 404);
      }

      const consultation = await db.consultation.create({
        data: {
          patientId,
          date: parseDateOnly(input.date),
          reason: input.reason,
          diagnosis: input.diagnosis,
          treatment: input.treatment,
          notes: input.notes,
          eventId: input.eventId,
        },
      });

      return replyRaw(c, consultation, 201);
    } catch (error) {
      console.error("Error creating consultation:", error);
      return replyRaw(c, { error: "Error al registrar la consulta", details: String(error) }, 500);
    }
  },
);

// POST /:id/budgets - Create budget for patient
patientsRoutes.post("/:id/budgets", zValidator("json", createBudgetSchema), async (c) => {
  const patientId = Number(c.req.param("id"));
  const input = c.req.valid("json");

  try {
    const totalAmount = input.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const finalAmount = totalAmount - input.discount;

    const budget = await db.budget.create({
      data: {
        patientId,
        title: input.title,
        totalAmount: new Decimal(totalAmount),
        discount: new Decimal(input.discount),
        finalAmount: new Decimal(finalAmount),
        notes: input.notes,
      },
    });

    return replyRaw(c, { ...budget, items: [] }, 201);
  } catch {
    console.error("Error creating budget:");
    return replyRaw(c, { error: "Error al crear el presupuesto" }, 500);
  }
});

// GET /:id/budgets - List patient budgets
patientsRoutes.get("/:id/budgets", async (c) => {
  const patientId = Number(c.req.param("id"));
  try {
    const budgets = await db.budget.findMany({
      where: { patientId },
      include: { payments: true },
      orderBy: { updatedAt: "desc" },
    });
    return replyRaw(
      c,
      budgets.map((budget) => ({ ...budget, items: [] })),
    );
  } catch {
    return replyRaw(c, { error: "Error al obtener presupuestos" }, 500);
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
        amount: new Decimal(input.amount),
        paymentDate: parseDateOnly(input.paymentDate),
        paymentMethod: input.paymentMethod,
        reference: input.reference,
        notes: input.notes,
      },
    });

    return replyRaw(c, payment, 201);
  } catch {
    console.error("Error registering payment:");
    return replyRaw(c, { error: "Error al registrar pago" }, 500);
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
    return replyRaw(c, payments);
  } catch {
    return replyRaw(c, { error: "Error al obtener pagos" }, 500);
  }
});

/**
 * POST /:id/attachments
 * Upload a document for a patient
 */
patientsRoutes.post("/:id/attachments", async (c) => {
  const { id } = c.req.param();
  const user = await getSessionUser(c);

  if (!user) {
    return replyRaw(c, { error: "No autorizado" }, 401);
  }

  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const type = (body.type as string) || "OTHER";
    const name = (body.name as string) || file.name || "Sin nombre";

    if (!file) {
      return replyRaw(c, { error: "No se proporcionó ningún archivo" }, 400);
    }

    // Save temp file
    const tempPath = path.join(os.tmpdir(), `${crypto.randomUUID()}_${file.name}`);
    const arrayBuffer = await file.arrayBuffer();
    fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));

    try {
      // Upload to Drive
      const { fileId, webViewLink } = await uploadPatientAttachmentToDrive(
        tempPath,
        name,
        file.type,
        id,
      );

      // Save to DB
      const attachmentType: AttachmentType =
        type === "CONSENT" || type === "EXAM" || type === "RECIPE" || type === "OTHER"
          ? type
          : "OTHER";
      const attachment = await db.patientAttachment.create({
        data: {
          patientId: Number(id),
          name: name,
          type: attachmentType,
          driveFileId: fileId,
          mimeType: file.type,
          uploadedBy: user.id,
        },
      });

      return replyRaw(c, { ...attachment, webViewLink });
    } finally {
      // Clean up
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  } catch (error) {
    console.error("Error uploading attachment:", error);
    return replyRaw(c, { error: "Error al subir el documento" }, 500);
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
    return replyRaw(c, attachments);
  } catch {
    return replyRaw(c, { error: "Error al obtener adjuntos" }, 500);
  }
});

export { patientsRoutes };
