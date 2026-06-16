import {
  allergenListInputSchema,
  allergenListResponseSchema,
  budgetCreatedResponseSchema,
  clinicTermsSchema,
  createBudgetInputSchema,
  createProductInputSchema,
  createImmunoAdministrationInputSchema,
  createScitPrescriptionInputSchema,
  idInputSchema,
  immunoAdministrationCreatedSchema,
  immunoAdministrationListResponseSchema,
  listImmunoAdministrationsInputSchema,
  listScitPrescriptionsInputSchema,
  okResponseSchema,
  prescriptionPdfInputSchema,
  productListResponseSchema,
  productResponseSchema,
  quoteInputSchema,
  quoteResultSchema,
  scitPrescriptionCreatedSchema,
  scitPrescriptionListResponseSchema,
  updateClinicTermsInputSchema,
  updateProductInputSchema,
} from "@finanzas/orpc-contracts/immunotherapy";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { z } from "zod";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ORPCError, onError, os } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import type { Context as HonoContext } from "hono";
import { getSessionUser, hasPermission } from "../lib/auth.ts";
import { logError } from "../lib/logger.ts";
import { configureSuperjson } from "../lib/superjson-config.ts";
import {
  computeQuote,
  createImmunotherapyBudget,
  createProduct,
  deleteProduct,
  generateBudgetPdfFile,
  generatePrescriptionPdfFile,
  getTerms,
  listAllergens,
  listProducts,
  updateProduct,
  updateTerms,
} from "../services/immunotherapy.ts";
import {
  createImmunoAdministration,
  listImmunoAdministrationsByPatient,
} from "../services/immunotherapy-administrations.ts";
import {
  createScitPrescription,
  listScitPrescriptionsByPatient,
} from "../services/scit-prescriptions.ts";
import { SuperJSONRPCHandler } from "./superjson.ts";

configureSuperjson();

type ImmunotherapyORPCContext = { hono: HonoContext };
const base = os.$context<ImmunotherapyORPCContext>();

const authed = base.use(async ({ context, next }) => {
  const user = await getSessionUser(context.hono);
  if (!user) throw new ORPCError("UNAUTHORIZED", { message: "No autorizado" });
  return next({ context: { ...context, user } });
});

function requirePermission(action: string, subject: string) {
  return authed.use(async ({ context, next }) => {
    const ok = await hasPermission(context.user, action, subject);
    if (!ok) throw new ORPCError("FORBIDDEN", { message: "Forbidden" });
    return next();
  });
}

const readBudgets = requirePermission("read", "Budget");
const createBudgets = requirePermission("create", "Budget");
const updateSettings = requirePermission("update", "Setting");
const readClinicalSeries = requirePermission("read", "ClinicalSeries");
const createClinicalSeries = requirePermission("create", "ClinicalSeries");

const immunotherapyRouterBase = {
  // ── Productos (catálogo editable) ──────────────────────────────────
  listProducts: readBudgets
    .route({ method: "GET", path: "/products", tags: ["Immunotherapy"] })
    .output(productListResponseSchema)
    .handler(async () => ({ products: await listProducts() })),

  createProduct: updateSettings
    .route({ method: "POST", path: "/products", tags: ["Immunotherapy"] })
    .input(createProductInputSchema)
    .output(productResponseSchema)
    .handler(async ({ input }) => ({ product: await createProduct(input) })),

  updateProduct: updateSettings
    .route({ method: "POST", path: "/products/{id}/update", tags: ["Immunotherapy"] })
    .input(updateProductInputSchema)
    .output(productResponseSchema)
    .handler(async ({ input }) => ({ product: await updateProduct(input) })),

  deleteProduct: updateSettings
    .route({ method: "DELETE", path: "/products/{id}", tags: ["Immunotherapy"] })
    .input(idInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await deleteProduct(input.id);
      return { ok: true as const };
    }),

  // ── Alérgenos ──────────────────────────────────────────────────────
  listAllergens: readBudgets
    .route({ method: "GET", path: "/allergens", tags: ["Immunotherapy"] })
    .input(allergenListInputSchema)
    .output(allergenListResponseSchema)
    .handler(async ({ input }) => ({ allergens: await listAllergens(input?.q) })),

  // ── Cotización ─────────────────────────────────────────────────────
  quote: createBudgets
    .route({ method: "POST", path: "/quote", tags: ["Immunotherapy"] })
    .input(quoteInputSchema)
    .output(quoteResultSchema)
    .handler(async ({ input }) => computeQuote(input)),

  createBudget: createBudgets
    .route({ method: "POST", path: "/budgets", tags: ["Immunotherapy"] })
    .input(createBudgetInputSchema)
    .output(budgetCreatedResponseSchema)
    .handler(async ({ input }) => {
      const { budgetId, quote } = await createImmunotherapyBudget(input);
      return { budgetId, quote, status: "ok" as const };
    }),

  generatePdf: createBudgets
    .route({ method: "POST", path: "/pdf", tags: ["Immunotherapy"] })
    .input(createBudgetInputSchema)
    .output(z.file())
    .handler(async ({ input }) => {
      const { pdfBytes, fileName } = await generateBudgetPdfFile(input);
      return new File([Buffer.from(pdfBytes)], fileName, { type: "application/pdf" });
    }),

  generatePrescriptionPdf: createBudgets
    .route({ method: "POST", path: "/prescription-pdf", tags: ["Immunotherapy"] })
    .input(prescriptionPdfInputSchema)
    .output(z.file())
    .handler(async ({ input }) => {
      const { pdfBytes, fileName } = await generatePrescriptionPdfFile(input);
      return new File([Buffer.from(pdfBytes)], fileName, { type: "application/pdf" });
    }),

  // ── Términos económicos + prestador (ClinicSettings singleton) ─────
  getTerms: readBudgets
    .route({ method: "GET", path: "/terms", tags: ["Immunotherapy"] })
    .output(clinicTermsSchema)
    .handler(async () => getTerms()),

  updateTerms: updateSettings
    .route({ method: "POST", path: "/terms/update", tags: ["Immunotherapy"] })
    .input(updateClinicTermsInputSchema)
    .output(clinicTermsSchema)
    .handler(async ({ input }) => updateTerms(input)),

  // ── Prescripciones SCIT (trazabilidad por paciente) ────────────────
  createScitPrescription: createClinicalSeries
    .route({ method: "POST", path: "/scit-prescriptions", tags: ["Immunotherapy"] })
    .input(createScitPrescriptionInputSchema)
    .output(scitPrescriptionCreatedSchema)
    .handler(async ({ input, context }) => createScitPrescription(input, context.user.id)),

  listScitPrescriptions: readClinicalSeries
    .route({ method: "GET", path: "/scit-prescriptions", tags: ["Immunotherapy"] })
    .input(listScitPrescriptionsInputSchema)
    .output(scitPrescriptionListResponseSchema)
    .handler(async ({ input }) => listScitPrescriptionsByPatient(input.patientId)),

  // ── Carnet de inmunoterapia (administración de dosis) ──────────────
  createImmunoAdministration: createClinicalSeries
    .route({ method: "POST", path: "/administrations", tags: ["Immunotherapy"] })
    .input(createImmunoAdministrationInputSchema)
    .output(immunoAdministrationCreatedSchema)
    .handler(async ({ input, context }) => createImmunoAdministration(input, context.user.id)),

  listImmunoAdministrations: readClinicalSeries
    .route({ method: "GET", path: "/administrations", tags: ["Immunotherapy"] })
    .input(listImmunoAdministrationsInputSchema)
    .output(immunoAdministrationListResponseSchema)
    .handler(async ({ input }) => listImmunoAdministrationsByPatient(input.patientId)),
};

export const immunotherapyORPCRouter = base
  .prefix("/api/orpc/immunotherapy")
  .router(immunotherapyRouterBase);

export const immunotherapyORPCHandler = new SuperJSONRPCHandler(immunotherapyORPCRouter, {
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "orpc.immunotherapy" });
    }),
  ],
});

export const immunotherapyOpenAPIHandler = new OpenAPIHandler(immunotherapyORPCRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Bioalergia Immunotherapy oRPC",
          description: "Contratos oRPC/OpenAPI para presupuestos de inmunoterapia.",
          version: "1.0.0",
        },
      },
    }),
  ],
  interceptors: [
    onError((error) => {
      logError(error, { module: "api", operation: "openapi.immunotherapy" });
    }),
  ],
});

export type ImmunotherapyORPCRouter = typeof immunotherapyORPCRouter;
