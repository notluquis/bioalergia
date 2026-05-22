import { db } from "@finanzas/db";
import {
  allergenListInputSchema,
  allergenListResponseSchema,
  budgetCreatedResponseSchema,
  clinicTermsSchema,
  createBudgetInputSchema,
  createProductInputSchema,
  idInputSchema,
  okResponseSchema,
  productListResponseSchema,
  productResponseSchema,
  quoteInputSchema,
  quoteResultSchema,
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
} from "../services/immunotherapy.ts";
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

type ProductWithStages = Awaited<ReturnType<typeof loadProduct>>;
async function loadProduct(id: number) {
  return db.immunotherapyProduct.findUnique({
    where: { id },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
}

function num(d: { toString: () => string } | null | undefined): number | null {
  return d == null ? null : Number(d.toString());
}

function serializeProduct(p: NonNullable<ProductWithStages>) {
  return {
    id: p.id,
    name: p.name,
    lab: p.lab,
    vaccineProduct: p.vaccineProduct,
    concentrationUtMl: p.concentrationUtMl,
    perAllergen: p.perAllergen,
    maxAllergens: p.maxAllergens,
    maintenanceTargetMl: num(p.maintenanceTargetMl) ?? 0,
    maintenanceStepMl: num(p.maintenanceStepMl) ?? 0,
    maintenanceDefaultQty: p.maintenanceDefaultQty,
    defaultDiscountPct: num(p.defaultDiscountPct),
    isActive: p.isActive,
    sortOrder: p.sortOrder,
    stages: p.stages.map((s: NonNullable<ProductWithStages>["stages"][number]) => ({
      id: s.id,
      productId: s.productId,
      label: s.label,
      unitPrice: num(s.unitPrice) ?? 0,
      defaultQty: s.defaultQty,
      isMaintenance: s.isMaintenance,
      sortOrder: s.sortOrder,
    })),
  };
}

const immunotherapyRouterBase = {
  // ── Productos (catálogo editable) ──────────────────────────────────
  listProducts: readBudgets
    .route({ method: "GET", path: "/products", tags: ["Immunotherapy"] })
    .output(productListResponseSchema)
    .handler(async () => {
      const products = await db.immunotherapyProduct.findMany({
        include: { stages: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
      return { products: products.map((p) => serializeProduct(p)) };
    }),

  createProduct: updateSettings
    .route({ method: "POST", path: "/products", tags: ["Immunotherapy"] })
    .input(createProductInputSchema)
    .output(productResponseSchema)
    .handler(async ({ input }) => {
      const created = await db.immunotherapyProduct.create({
        data: {
          name: input.name,
          lab: input.lab ?? null,
          vaccineProduct: input.vaccineProduct ?? null,
          concentrationUtMl: input.concentrationUtMl ?? null,
          perAllergen: input.perAllergen,
          maxAllergens: input.maxAllergens ?? null,
          maintenanceTargetMl: input.maintenanceTargetMl,
          maintenanceStepMl: input.maintenanceStepMl,
          maintenanceDefaultQty: input.maintenanceDefaultQty,
          defaultDiscountPct: input.defaultDiscountPct ?? null,
          isActive: input.isActive,
          sortOrder: input.sortOrder,
          stages: {
            create: input.stages.map((s, i) => ({
              label: s.label,
              unitPrice: s.unitPrice,
              defaultQty: s.defaultQty,
              isMaintenance: s.isMaintenance,
              sortOrder: s.sortOrder ?? i,
            })),
          },
        },
        include: { stages: { orderBy: { sortOrder: "asc" } } },
      });
      return { product: serializeProduct(created) };
    }),

  updateProduct: updateSettings
    .route({ method: "POST", path: "/products/{id}/update", tags: ["Immunotherapy"] })
    .input(updateProductInputSchema)
    .output(productResponseSchema)
    .handler(async ({ input }) => {
      const existing = await db.immunotherapyProduct.findUnique({ where: { id: input.id } });
      if (!existing) throw new ORPCError("NOT_FOUND", { message: "Producto no encontrado" });

      const { id, stages, ...rest } = input;
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined) data[k] = v;
      }
      // Reemplazo total de etapas si vienen en el payload.
      if (stages !== undefined) {
        await db.immunotherapyDoseStage.deleteMany({ where: { productId: id } });
        data.stages = {
          create: stages.map((s, i) => ({
            label: s.label,
            unitPrice: s.unitPrice,
            defaultQty: s.defaultQty,
            isMaintenance: s.isMaintenance,
            sortOrder: s.sortOrder ?? i,
          })),
        };
      }
      const updated = await db.immunotherapyProduct.update({
        where: { id },
        data,
        include: { stages: { orderBy: { sortOrder: "asc" } } },
      });
      return { product: serializeProduct(updated) };
    }),

  deleteProduct: updateSettings
    .route({ method: "DELETE", path: "/products/{id}", tags: ["Immunotherapy"] })
    .input(idInputSchema)
    .output(okResponseSchema)
    .handler(async ({ input }) => {
      await db.immunotherapyProduct.delete({ where: { id: input.id } });
      return { ok: true as const };
    }),

  // ── Alérgenos ──────────────────────────────────────────────────────
  listAllergens: readBudgets
    .route({ method: "GET", path: "/allergens", tags: ["Immunotherapy"] })
    .input(allergenListInputSchema)
    .output(allergenListResponseSchema)
    .handler(async ({ input }) => {
      const where: Record<string, unknown> = { isActive: true };
      const q = input?.q?.trim();
      if (q) {
        where.OR = [
          { commonName: { contains: q, mode: "insensitive" as const } },
          { scientificName: { contains: q, mode: "insensitive" as const } },
        ];
      }
      const allergens = await db.clinicalAllergen.findMany({
        where,
        select: { id: true, commonName: true, scientificName: true },
        orderBy: { commonName: "asc" },
        take: 500,
      });
      return { allergens };
    }),

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
      const patient = await db.patient.findUnique({
        where: { id: input.patientId },
        select: {
          person: { select: { names: true, fatherName: true, motherName: true, rut: true } },
        },
      });
      if (!patient) throw new ORPCError("NOT_FOUND", { message: "Paciente no encontrado" });

      const quote = await computeQuote(input);
      const clinic = await db.clinicSettings.upsert({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
      const product = await db.immunotherapyProduct.findUnique({
        where: { id: input.productId },
        select: { lab: true },
      });

      const fullName = [
        patient.person.names,
        patient.person.fatherName,
        patient.person.motherName,
      ]
        .filter(Boolean)
        .join(" ");

      // Interpola la plantilla de introducción con datos del presupuesto.
      const intro = clinic.immunoBudgetIntro
        ? clinic.immunoBudgetIntro
            .replaceAll("{{paciente}}", fullName)
            .replaceAll("{{apoderado}}", input.parentName?.trim() || "apoderado/a")
            .replaceAll("{{diagnostico}}", input.diagnosis?.trim() || "su condición alérgica")
        : null;

      // Lazy: pdf-lib pesa ~3MB en heap; cargar sólo al primer /pdf.
      const { generateBudgetPdf } = await import(
        "../modules/immunotherapy/budget-pdf.service.ts"
      );
      const pdfBytes = await generateBudgetPdf({
        clinic: {
          name: clinic.name,
          legalName: clinic.legalName,
          legalRut: clinic.legalRut,
          address: clinic.address,
          phoneWhatsapp: clinic.phoneWhatsapp,
          phoneLandline: clinic.phoneLandline,
          email: clinic.email,
          doctorName: clinic.doctorName,
          doctorRut: clinic.doctorRut,
        },
        patient: { name: fullName, rut: patient.person.rut },
        quote,
        lab: product?.lab ?? null,
        terms: clinic.immunoBudgetTerms,
        intro,
      });

      const fileName = `presupuesto_inmunoterapia_${(patient.person.rut ?? "sin_rut").replace(
        /\./g,
        ""
      )}.pdf`;
      return new File([Buffer.from(pdfBytes)], fileName, { type: "application/pdf" });
    }),

  // ── Términos económicos + prestador (ClinicSettings singleton) ─────
  getTerms: readBudgets
    .route({ method: "GET", path: "/terms", tags: ["Immunotherapy"] })
    .output(clinicTermsSchema)
    .handler(async () => {
      const s = await db.clinicSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
      return {
        legalName: s.legalName,
        legalRut: s.legalRut,
        immunoBudgetTerms: s.immunoBudgetTerms,
        immunoBudgetIntro: s.immunoBudgetIntro,
      };
    }),

  updateTerms: updateSettings
    .route({ method: "POST", path: "/terms/update", tags: ["Immunotherapy"] })
    .input(updateClinicTermsInputSchema)
    .output(clinicTermsSchema)
    .handler(async ({ input }) => {
      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) data[k] = v;
      }
      const s = await db.clinicSettings.upsert({
        where: { id: 1 },
        update: data,
        create: { id: 1, ...data },
      });
      return {
        legalName: s.legalName,
        legalRut: s.legalRut,
        immunoBudgetTerms: s.immunoBudgetTerms,
        immunoBudgetIntro: s.immunoBudgetIntro,
      };
    }),
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
