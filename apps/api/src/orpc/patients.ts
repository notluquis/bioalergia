import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Decimal } from "decimal.js";
import type { Context as HonoContext } from "hono";
import type {
  Consultation,
  MedicalCertificate,
  MedicalPrescription,
  PatientAttachment,
  Person,
} from "@finanzas/db/models";
import { createSchemaFactory, schema } from "@finanzas/db/zod";
import { z } from "zod";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logAuditFromContext } from "../lib/audit-log.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  createPatient,
  createPatientAttachment,
  createPatientBudget,
  createPatientConsultation,
  createPatientPayment,
  getPatientClinicalSeries,
  getPatientDetail,
  getPatientSkinTests,
  listPatientBudgets,
  listPatientDteSources,
  listPatientPayments,
  listPatients,
  syncPatientDteSaleSources,
  updatePatient,
} from "../services/patients-router.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

const dbSchemas = createSchemaFactory(schema);

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
  birthDate: z.string().optional(),
  bloodType: z.string().optional(),
  email: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  names: z.string().min(1),
  notes: z.string().optional(),
  phone: z.string().optional(),
  rut: z.string().min(1),
  sex: z.enum(["M", "F", "X"]).optional(),
});

const updatePatientInputSchema = createPatientInputSchema.partial().extend({
  patientId: z.number().int().positive(),
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

const createAttachmentInputSchema = z.object({
  file: z.file(),
  name: z.string().optional(),
  patientId: z.number().int().positive(),
  type: z.string().min(1),
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

// ZenStack's ZodObject<GetModelFieldsShape<...>, $strict> doesn't directly satisfy
// z.ZodType<T> without excessive type instantiation (TS2589). The cast is safe:
// makeModelSchema generates a schema that validates exactly to the model type.
const personSchema = dbSchemas.makeModelSchema("Person") as unknown as z.ZodType<Person>;

const consultationSchema = dbSchemas.makeModelSchema(
  "Consultation"
) as unknown as z.ZodType<Consultation>;

const attachmentSchema = dbSchemas.makeModelSchema("PatientAttachment").extend({
  webViewLink: z.string().optional(), // added by Google Drive upload, not stored in DB
}) as unknown as z.ZodType<PatientAttachment & { webViewLink?: string }>;

const medicalCertificateSchema = dbSchemas.makeModelSchema(
  "MedicalCertificate"
) as unknown as z.ZodType<MedicalCertificate>;

const medicalPrescriptionSchema = dbSchemas.makeModelSchema(
  "MedicalPrescription"
) as unknown as z.ZodType<MedicalPrescription>;

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
  medicalPrescriptions: z.array(medicalPrescriptionSchema),
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

const attachmentResponseSchema = z.object({
  attachment: attachmentSchema,
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

/**
 * Build the where clause used by the patient search endpoint.
 *
 * For each token, name fields use raw contains (case-insensitive). The
 * rut field uses the same token but with dots and whitespace stripped,
 * so "20.275" matches the canonical-stored "20275995-5" via contains.
 * Full RUT inputs ("20.275.995-5") collapse to canonical
 * ("20275995-5") naturally; partial prefixes ("2027") still match
 * because we never reshape the token into a fake canonical form. K is
 * uppercased so "11222333-k" matches DB "11222333-K".
 *
 * Exported for unit testing.
 */
export function buildPatientSearchWhere(query: string | undefined) {
  const tokens = query
    ? query
        .trim()
        .split(/\s+/)
        .filter((t) => t.length > 0)
    : [];
  if (tokens.length === 0) return {};
  return {
    person: {
      AND: tokens.map((token) => {
        const rutToken = token.replace(/[.\s]/g, "").toUpperCase();
        return {
          OR: [
            { names: { contains: token, mode: "insensitive" as const } },
            { fatherName: { contains: token, mode: "insensitive" as const } },
            { motherName: { contains: token, mode: "insensitive" as const } },
            { rut: { contains: rutToken, mode: "insensitive" as const } },
          ],
        };
      }),
    },
  };
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

const updatePatients = authed.use(async ({ context, next }) => {
  const canUpdate = await hasPermission(context.user, "update", "Patient");

  if (!canUpdate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readBudgets = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Budget");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPatients = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "Patient");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createPatients = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Patient");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createConsultations = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Consultation");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createBudgets = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "Budget");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const readPayments = authed.use(async ({ context, next }) => {
  const canRead = await hasPermission(context.user, "read", "PatientPayment");

  if (!canRead) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const createPayments = authed.use(async ({ context, next }) => {
  const canCreate = await hasPermission(context.user, "create", "PatientPayment");

  if (!canCreate) {
    throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
  }

  return next();
});

const patientsORPCRouterBase = {
  create: createPatients
    .route({ method: "POST", path: "/", tags: ["Patients"] })
    .input(createPatientInputSchema)
    .output(patientResponseSchema)
    .handler(async ({ input }) => {
      const patient = await createPatient(input);
      return {
        patient,
        status: "ok",
      };
    }),

  update: updatePatients
    .route({ method: "PUT", path: "/{patientId}", tags: ["Patients"] })
    .input(updatePatientInputSchema)
    .output(patientResponseSchema)
    .handler(async ({ input }) => {
      const updated = await updatePatient(input);
      return { patient: updated, status: "ok" };
    }),

  createAttachment: updatePatients
    .route({ method: "POST", path: "/attachments", tags: ["Patients"] })
    .input(createAttachmentInputSchema)
    .output(attachmentResponseSchema)
    .handler(async ({ context, input }) => {
      const attachment = await createPatientAttachment({
        ...input,
        uploadedBy: context.user.id,
      });

      return {
        attachment,
        status: "ok" as const,
      };
    }),

  createBudget: createBudgets
    .route({ method: "POST", path: "/budgets", tags: ["Patients"] })
    .input(createBudgetInputSchema)
    .output(budgetResponseSchema)
    .handler(async ({ input }) => {
      const budget = await createPatientBudget(input);
      return {
        budget,
        status: "ok",
      };
    }),

  createConsultation: createConsultations
    .route({ method: "POST", path: "/consultations", tags: ["Patients"] })
    .input(createConsultationInputSchema)
    .output(consultationResponseSchema)
    .handler(async ({ input }) => {
      const consultation = await createPatientConsultation(input);
      return {
        consultation,
        status: "ok",
      };
    }),

  createPayment: createPayments
    .route({ method: "POST", path: "/payments", tags: ["Patients"] })
    .input(createPaymentInputSchema)
    .output(paymentResponseSchema)
    .handler(async ({ input }) => {
      const payment = await createPatientPayment(input);
      return {
        payment,
        status: "ok",
      };
    }),

  listBudgets: readBudgets
    .route({ method: "GET", path: "/{patientId}/budgets", tags: ["Patients"] })
    .input(patientIdInputSchema)
    .output(budgetListResponseSchema)
    .handler(async ({ input }) => {
      const budgets = await listPatientBudgets(input.patientId);
      return {
        budgets,
        status: "ok",
      };
    }),

  listPayments: readPayments
    .route({ method: "GET", path: "/{patientId}/payments", tags: ["Patients"] })
    .input(patientIdInputSchema)
    .output(paymentListResponseSchema)
    .handler(async ({ input }) => {
      const payments = await listPatientPayments(input.patientId);
      return {
        payments,
        status: "ok",
      };
    }),

  detail: readPatients
    .route({ method: "GET", path: "/{patientId}", tags: ["Patients"] })
    .input(patientIdInputSchema)
    .output(patientDetailResponseSchema)
    .handler(async ({ context, input }) => {
      const patient = await getPatientDetail(input.patientId);
      // Ficha access log (Decreto 41/2012 art. 9). Fire-and-forget: never
      // awaited into latency, never breaks the read (logAuditEvent swallows).
      void logAuditFromContext(context.hono, {
        kind: "CLINICAL_RECORD_READ",
        userId: context.user.id,
        actorLabel: context.user.email,
        resource: "Patient",
        resourceId: input.patientId,
        message: "ficha:detail",
      });
      return {
        patient,
        status: "ok",
      };
    }),

  list: readPatients
    .route({ method: "GET", path: "/", tags: ["Patients"] })
    .input(listPatientsInputSchema)
    .output(patientListResponseSchema)
    .handler(async ({ input }) => {
      const patients = await listPatients(buildPatientSearchWhere(input.q));
      return {
        patients,
        status: "ok",
      };
    }),

  listDteSources: readPatients
    .route({ method: "GET", path: "/sources/dte", tags: ["Patients"] })
    .input(listPatientDteSourcesInputSchema)
    .output(patientDteSourceListResponseSchema)
    .handler(async ({ input }) => {
      const rows = await listPatientDteSources(input);
      return {
        rows,
        status: "ok",
      };
    }),

  syncDteSources: readPatients
    .route({ method: "POST", path: "/sources/dte/sync", tags: ["Patients"] })
    .input(syncPatientDteSourcesInputSchema)
    .output(patientDteSyncResponseSchema)
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

  getClinicalSeries: readPatients
    .route({ method: "GET", path: "/:patientId/clinical-series", tags: ["Patients"] })
    .input(z.object({ patientId: z.number().int() }))
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.number(),
            kind: z.string(),
            status: z.string(),
            displayName: z.string().nullable(),
            patientName: z.string().nullable(),
            patientRut: z.string().nullable(),
            skinTestsCount: z.number(),
            eventsCount: z.number(),
            clinicalDate: z.string().nullable(),
            createdAt: z.string(),
          })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      const items = await getPatientClinicalSeries(input.patientId);
      void logAuditFromContext(context.hono, {
        kind: "CLINICAL_RECORD_READ",
        userId: context.user.id,
        actorLabel: context.user.email,
        resource: "Patient",
        resourceId: input.patientId,
        message: "ficha:clinical-series",
      });
      return { items };
    }),

  getSkinTests: readPatients
    .route({ method: "GET", path: "/:patientId/skin-tests", tags: ["Patients"] })
    .input(z.object({ patientId: z.number().int() }))
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            testDate: z.string(),
            patientName: z.string().nullable(),
            patientRut: z.string().nullable(),
            panelTitle: z.string().nullable(),
            physicianName: z.string().nullable(),
            resultsCount: z.number(),
            seriesId: z.number(),
            seriesKind: z.string(),
          })
        ),
      })
    )
    .handler(async ({ context, input }) => {
      const items = await getPatientSkinTests(input.patientId);
      void logAuditFromContext(context.hono, {
        kind: "CLINICAL_RECORD_READ",
        userId: context.user.id,
        actorLabel: context.user.email,
        resource: "Patient",
        resourceId: input.patientId,
        message: "ficha:skin-tests",
      });
      return { items };
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
