import { db } from "@finanzas/db";
import { patientsContract } from "@finanzas/orpc-contracts/patients";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone.js";
import Decimal from "decimal.js";
import type { Context as HonoContext } from "hono";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../auth";
import { logError } from "../lib/logger";
import { configureSuperjson } from "../lib/superjson-config";
import { SuperJSONRPCHandler } from "./superjson";

configureSuperjson();
dayjs.extend(timezone);

const TIMEZONE = "America/Santiago";

type PatientsORPCContext = {
  hono: HonoContext;
};

const base = os.$context<PatientsORPCContext>();

const decimalSchema = z.union([z.instanceof(Decimal), z.number(), z.string()]);

const budgetItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(1),
  unitPrice: z.number().min(0),
});

const createBudgetInputSchema = z.object({
  discount: z.number().min(0),
  items: z.array(budgetItemInputSchema).min(1),
  notes: z.string().optional(),
  patientId: z.number().int(),
  title: z.string().min(1),
});

const createPatientInputSchema = z.object({
  address: z.string().optional(),
  birthDate: z.string().optional(),
  bloodType: z.string().optional(),
  email: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  names: z.string().min(1),
  notes: z.string().optional(),
  phone: z.string().optional(),
  rut: z.string().min(1),
});

const createConsultationInputSchema = z.object({
  date: z.string().min(1),
  diagnosis: z.string().optional(),
  eventId: z.number().int().optional(),
  notes: z.string().optional(),
  patientId: z.number().int(),
  reason: z.string().min(1),
  treatment: z.string().optional(),
});

const patientIdInputSchema = z.object({
  patientId: z.number().int(),
});

const createPaymentInputSchema = z.object({
  amount: z.number().positive(),
  budgetId: z.number().int().optional(),
  notes: z.string().optional(),
  patientId: z.number().int(),
  paymentDate: z.string().min(1),
  paymentMethod: z.enum(["Transferencia", "Efectivo", "Tarjeta", "Otro"]),
  reference: z.string().optional(),
});

const listPatientsInputSchema = z.object({
  q: z.string().optional(),
});

const listPatientDteSourcesInputSchema = z.object({
  limit: z.number().int().positive().max(1000).optional(),
  period: z.string().optional(),
  q: z.string().optional(),
});

const syncPatientDteSourcesInputSchema = z.object({
  documentTypes: z.array(z.number().int().positive()).optional(),
  dryRun: z.boolean().optional(),
  limit: z.number().int().positive().max(5000).optional(),
  period: z.string().optional(),
});

const patientPaymentSchema = z.object({
  amount: decimalSchema,
  budgetId: z.number().nullable().optional(),
  createdAt: z.date(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  paymentDate: z.date(),
  paymentMethod: z.string(),
  reference: z.string().nullable().optional(),
});

const budgetSchema = z.object({
  createdAt: z.date(),
  discount: decimalSchema,
  finalAmount: decimalSchema,
  id: z.number().int(),
  items: z.array(z.unknown()),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  payments: z.array(patientPaymentSchema).optional(),
  status: z.string(),
  title: z.string(),
  totalAmount: decimalSchema,
  updatedAt: z.date(),
});

const personSchema = z.object({
  address: z.string().nullable().optional(),
  createdAt: z.date(),
  email: z.string().nullable().optional(),
  fatherName: z.string().nullable().optional(),
  id: z.number().int(),
  motherName: z.string().nullable().optional(),
  names: z.string(),
  personType: z.string(),
  phone: z.string().nullable().optional(),
  rut: z.string(),
  updatedAt: z.date(),
});

const consultationSchema = z.object({
  createdAt: z.date(),
  date: z.date(),
  diagnosis: z.string().nullable().optional(),
  eventId: z.number().nullable().optional(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  patientId: z.number().int(),
  reason: z.string(),
  treatment: z.string().nullable().optional(),
  updatedAt: z.date(),
});

const attachmentSchema = z.object({
  driveFileId: z.string(),
  id: z.string(),
  mimeType: z.string().nullable().optional(),
  name: z.string(),
  patientId: z.number().int(),
  type: z.string(),
  uploadedAt: z.date(),
  uploadedBy: z.number().int(),
  webViewLink: z.string().optional(),
});

const medicalCertificateSchema = z.object({
  address: z.string(),
  birthDate: z.date(),
  diagnosis: z.string(),
  driveFileId: z.string(),
  id: z.string(),
  issuedAt: z.date(),
  issuedBy: z.number().int(),
  metadata: z.unknown().nullable().optional(),
  patientId: z.number().nullable().optional(),
  patientName: z.string(),
  patientRut: z.string(),
  pdfHash: z.string(),
  purpose: z.string(),
  purposeDetail: z.string().nullable().optional(),
  restDays: z.number().nullable().optional(),
  restEndDate: z.date().nullable().optional(),
  restStartDate: z.date().nullable().optional(),
  symptoms: z.string().nullable().optional(),
});

const patientListItemSchema = z.object({
  birthDate: z.date().nullable().optional(),
  bloodType: z.string().nullable().optional(),
  createdAt: z.date(),
  id: z.number().int(),
  notes: z.string().nullable().optional(),
  person: personSchema,
  personId: z.number().int(),
  updatedAt: z.date(),
});

const patientDetailSchema = z.object({
  attachments: z.array(attachmentSchema),
  birthDate: z.date().nullable().optional(),
  bloodType: z.string().nullable().optional(),
  budgets: z.array(budgetSchema),
  consultations: z.array(consultationSchema),
  createdAt: z.date(),
  id: z.number().int(),
  medicalCertificates: z.array(medicalCertificateSchema),
  notes: z.string().nullable().optional(),
  payments: z.array(patientPaymentSchema),
  person: personSchema,
  personId: z.number().int(),
  updatedAt: z.date(),
});

const patientDteSourceSchema = z.object({
  clientName: z.string(),
  clientRUT: z.string(),
  documentDate: z.date().nullable().optional(),
  documentType: z.number(),
  folio: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  sourceUpdatedAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

const budgetListResponseSchema = z.object({
  budgets: z.array(budgetSchema),
  status: z.literal("ok"),
});

const budgetResponseSchema = z.object({
  budget: budgetSchema,
  status: z.literal("ok"),
});

const paymentResponseSchema = z.object({
  payment: patientPaymentSchema,
  status: z.literal("ok"),
});

const paymentListResponseSchema = z.object({
  payments: z.array(patientPaymentSchema),
  status: z.literal("ok"),
});

const patientListResponseSchema = z.object({
  patients: z.array(patientListItemSchema),
  status: z.literal("ok"),
});

const patientDetailResponseSchema = z.object({
  patient: patientDetailSchema,
  status: z.literal("ok"),
});

const patientResponseSchema = z.object({
  patient: patientListItemSchema,
  status: z.literal("ok"),
});

const consultationResponseSchema = z.object({
  consultation: consultationSchema,
  status: z.literal("ok"),
});

const patientDteSourceListResponseSchema = z.object({
  rows: z.array(patientDteSourceSchema),
  status: z.literal("ok"),
});

const patientDteSyncResponseSchema = z.object({
  dryRun: z.boolean(),
  inserted: z.number(),
  message: z.string(),
  selected: z.number(),
  skipped: z.number(),
  status: z.literal("ok"),
  updated: z.number(),
});

function parseDateOnly(value: string) {
  return dayjs.tz(value, "YYYY-MM-DD", TIMEZONE).toDate();
}

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);

  if (!user) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }

  return next({
    context: {
      ...context,
      user,
    },
  });
});

const readBudgets = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Budget");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPatients = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "Patient");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createPatients = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Patient");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createConsultations = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Consultation");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createBudgets = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "Budget");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPayments = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user.id, "read", "PatientPayment");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createPayments = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user.id, "create", "PatientPayment");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const patientsORPCRouterBase = {
  create: createPatients
    .route(patientsContract.create)
    .handler(async ({ input }) => {
      let person = await db.person.findUnique({
        where: { rut: input.rut },
      });

      if (person) {
        const existingPatient = await db.patient.findUnique({
          where: { personId: person.id },
        });

        if (existingPatient) {
          throw new ORPCError("CONFLICT", { message: "El paciente ya está registrado" });
        }

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

      return {
        patient,
        status: "ok",
      };
    }),

  createBudget: createBudgets
    .route(patientsContract.createBudget)
    .handler(async ({ input }) => {
      const totalAmount = input.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const finalAmount = totalAmount - input.discount;

      const budget = await db.budget.create({
        data: {
          patientId: input.patientId,
          title: input.title,
          totalAmount: new Decimal(totalAmount),
          discount: new Decimal(input.discount),
          finalAmount: new Decimal(finalAmount),
          notes: input.notes,
        },
        include: {
          payments: true,
        },
      });

      return {
        budget: {
          ...budget,
          items: [],
        },
        status: "ok",
      };
    }),

  createConsultation: createConsultations
    .route(patientsContract.createConsultation)
    .handler(async ({ input }) => {
      const patient = await db.patient.findUnique({
        where: { id: input.patientId },
      });

      if (!patient) {
        throw new ORPCError("NOT_FOUND", { message: "Paciente no encontrado" });
      }

      const consultation = await db.consultation.create({
        data: {
          patientId: input.patientId,
          date: parseDateOnly(input.date),
          reason: input.reason,
          diagnosis: input.diagnosis,
          treatment: input.treatment,
          notes: input.notes,
          eventId: input.eventId,
        },
      });

      return {
        consultation,
        status: "ok",
      };
    }),

  createPayment: createPayments
    .route(patientsContract.createPayment)
    .handler(async ({ input }) => {
      const payment = await db.patientPayment.create({
        data: {
          patientId: input.patientId,
          budgetId: input.budgetId,
          amount: new Decimal(input.amount),
          paymentDate: parseDateOnly(input.paymentDate),
          paymentMethod: input.paymentMethod,
          reference: input.reference,
          notes: input.notes,
        },
      });

      return {
        payment,
        status: "ok",
      };
    }),

  listBudgets: readBudgets
    .route(patientsContract.listBudgets)
    .handler(async ({ input }) => {
      const budgets = await db.budget.findMany({
        where: { patientId: input.patientId },
        include: { payments: true },
        orderBy: { updatedAt: "desc" },
      });

      return {
        budgets: budgets.map((budget) => ({
          ...budget,
          items: [],
        })),
        status: "ok",
      };
    }),

  listPayments: readPayments
    .route(patientsContract.listPayments)
    .handler(async ({ input }) => {
      const payments = await db.patientPayment.findMany({
        where: { patientId: input.patientId },
        orderBy: { paymentDate: "desc" },
      });

      return {
        payments,
        status: "ok",
      };
    }),

  detail: readPatients
    .route(patientsContract.detail)
    .handler(async ({ input }) => {
      const patient = await db.patient.findUnique({
        where: { id: input.patientId },
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
        throw new ORPCError("NOT_FOUND", { message: "Paciente no encontrado" });
      }

      return {
        patient: withBudgetItems(patient),
        status: "ok",
      };
    }),

  list: readPatients
    .route(patientsContract.list)
    .handler(async ({ input }) => {
      const where = input.q
        ? {
            person: {
              OR: [
                { names: { contains: input.q, mode: "insensitive" } },
                { fatherName: { contains: input.q, mode: "insensitive" } },
                { motherName: { contains: input.q, mode: "insensitive" } },
                { rut: { contains: input.q, mode: "insensitive" } },
              ],
            },
          }
        : {};

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

      return {
        patients,
        status: "ok",
      };
    }),

  listDteSources: readPatients
    .route(patientsContract.listDteSources)
    .handler(async ({ input }) => {
      const maxRows = Math.min(input.limit || 100, 1000);
      const rows = await db.patientDteSaleSource.findMany({
        where: {
          AND: [
            input.period ? { period: input.period } : {},
            input.q
              ? {
                  OR: [
                    { clientRUT: { contains: input.q, mode: "insensitive" } },
                    { clientName: { contains: input.q, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        orderBy: [{ updatedAt: "desc" }],
        take: maxRows,
      });

      return {
        rows,
        status: "ok",
      };
    }),

  syncDteSources: readPatients
    .route(patientsContract.syncDteSources)
    .handler(async ({ input }) => {
      const result = await syncPatientDteSaleSources({
        dryRun: input.dryRun ?? false,
        documentTypes: input.documentTypes,
        limit: input.limit,
        period: input.period,
      });

      return {
        ...result,
        status: "ok",
      };
    }),
};

export const patientsORPCRouter = base.prefix("/api/orpc/patients").router(patientsORPCRouterBase);

export const patientsORPCHandler = new SuperJSONRPCHandler(patientsORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "orpc.patients",
      });
    }),
  ],
});

export const patientsOpenAPIHandler = new OpenAPIHandler(patientsORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Patients oRPC",
          description: "Contratos oRPC/OpenAPI para presupuestos y pagos de pacientes.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, {
        module: "api",
        operation: "openapi.patients",
      });
    }),
  ],
});

export type PatientsORPCRouter = typeof patientsORPCRouter;
