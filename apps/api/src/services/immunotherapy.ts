import { db } from "@finanzas/db";
import type {
  CreateBudgetInput,
  CreateProductInput,
  ProductDto,
  PrescriptionPdfInput,
  QuoteInput,
  QuoteResult,
  UpdateProductInput,
} from "@finanzas/orpc-contracts/immunotherapy";
import type { z } from "zod";
import type {
  allergenLiteSchema,
  clinicTermsSchema,
  updateClinicTermsInputSchema,
} from "@finanzas/orpc-contracts/immunotherapy";
import { Decimal } from "decimal.js";
import { DomainError } from "../lib/errors.ts";

// Lógica de presupuesto de inmunoterapia (ITA), fuera de los handlers oRPC.
// El service valida, calcula el desglose y lanza DomainError (mapeado a HTTP
// por orpc/error.ts). Los precios/etapas viven 100% en DB (ImmunotherapyProduct
// + ImmunotherapyDoseStage); aquí no hay montos hardcodeados.

type AllergenLiteDto = z.infer<typeof allergenLiteSchema>;
type ClinicTermsDto = z.infer<typeof clinicTermsSchema>;
type UpdateClinicTermsInput = z.infer<typeof updateClinicTermsInputSchema>;

// CLP no usa decimales: redondeamos a entero en cada línea y en el total.
function clp(value: Decimal.Value): number {
  return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

type AllergenLite = { id: string; commonName: string; scientificName: string | null };

async function loadAllergens(ids: string[] | undefined): Promise<AllergenLite[]> {
  if (!ids || ids.length === 0) return [];
  const rows = await db.clinicalAllergen.findMany({
    where: { id: { in: ids } },
    select: { id: true, commonName: true, scientificName: true },
  });
  // Preserva el orden de selección del usuario.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is AllergenLite => r != null);
}

/**
 * Calcula el desglose de una cotización sin persistir. La etapa de mantención
 * ajusta su precio proporcional al volumen: precioBase × (mL / targetMl).
 */
export async function computeQuote(input: QuoteInput): Promise<QuoteResult> {
  const product = await db.immunotherapyProduct.findUnique({
    where: { id: input.productId },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
  if (!product) {
    throw new DomainError("NOT_FOUND", "Producto de inmunoterapia no encontrado");
  }
  if (product.stages.length === 0) {
    throw new DomainError("BAD_REQUEST", "El producto no tiene etapas de dosis configuradas");
  }

  const allergenIds = input.allergenIds ?? [];
  if (product.maxAllergens != null && allergenIds.length > product.maxAllergens) {
    throw new DomainError(
      "BAD_REQUEST",
      `${product.name} admite máximo ${product.maxAllergens} alérgeno(s); seleccionaste ${allergenIds.length}.`
    );
  }

  const targetMl = new Decimal(product.maintenanceTargetMl.toString());
  const maintenanceMl = input.maintenanceMl != null ? new Decimal(input.maintenanceMl) : targetMl;
  if (maintenanceMl.lte(0)) {
    throw new DomainError("BAD_REQUEST", "El volumen de mantención debe ser mayor a 0");
  }

  const overrideByStage = new Map((input.stageOverrides ?? []).map((o) => [o.stageId, o]));

  const lines = product.stages.map((stage: (typeof product.stages)[number]) => {
    const override = overrideByStage.get(stage.id);
    const baseUnit = new Decimal(
      override?.unitPrice != null ? override.unitPrice : stage.unitPrice.toString()
    );

    let unitPrice: number;
    let quantity: number;
    if (stage.isMaintenance) {
      // Precio proporcional al volumen respecto del target.
      unitPrice = clp(baseUnit.times(maintenanceMl).div(targetMl));
      quantity = override?.qty ?? input.maintenanceQty ?? product.maintenanceDefaultQty;
    } else {
      unitPrice = clp(baseUnit);
      quantity = override?.qty ?? stage.defaultQty;
    }

    return {
      stageId: stage.id,
      label: stage.label,
      quantity,
      unitPrice,
      subtotal: clp(new Decimal(unitPrice).times(quantity)),
      isMaintenance: stage.isMaintenance,
    };
  });

  const subtotal = clp(
    lines.reduce((acc: Decimal, l: (typeof lines)[number]) => acc.plus(l.subtotal), new Decimal(0))
  );

  const discountPct =
    input.discountPct ??
    (product.defaultDiscountPct != null ? Number(product.defaultDiscountPct.toString()) : 0);
  const discountAmount = clp(new Decimal(subtotal).times(discountPct).div(100));
  const total = clp(new Decimal(subtotal).minus(discountAmount));

  const allergens = await loadAllergens(allergenIds);

  return {
    productId: product.id,
    productName: product.name,
    concentrationUtMl: product.concentrationUtMl,
    perAllergen: product.perAllergen,
    maintenanceMl: maintenanceMl.toNumber(),
    lines,
    subtotal,
    discountPct,
    discountAmount,
    total,
    allergens,
    hiddenSections: input.hiddenSections ?? [],
  };
}

/**
 * Crea un presupuesto (modelo `Budget`) a partir de una cotización de ITA.
 * `Budget` no persiste items, así que el desglose se guarda en `notes` (JSON)
 * para reconstruir/imprimir el detalle después.
 */
export async function createImmunotherapyBudget(
  input: CreateBudgetInput
): Promise<{ budgetId: number; quote: QuoteResult }> {
  const patient = await db.patient.findUnique({ where: { id: input.patientId } });
  if (!patient) {
    throw new DomainError("NOT_FOUND", "Paciente no encontrado");
  }

  const quote = await computeQuote(input);

  const notes = JSON.stringify({
    kind: "immunotherapy",
    productId: quote.productId,
    productName: quote.productName,
    concentrationUtMl: quote.concentrationUtMl,
    perAllergen: quote.perAllergen,
    maintenanceMl: quote.maintenanceMl,
    discountPct: quote.discountPct,
    lines: quote.lines,
    allergens: quote.allergens,
    hiddenSections: quote.hiddenSections,
  });

  const budget = await db.budget.create({
    data: {
      patientId: input.patientId,
      title: input.title ?? `Inmunoterapia ${quote.productName} (anual)`,
      totalAmount: new Decimal(quote.subtotal),
      discount: new Decimal(quote.discountAmount),
      finalAmount: new Decimal(quote.total),
      notes,
    },
    select: { id: true },
  });

  return { budgetId: budget.id, quote };
}

// ── Productos (catálogo editable) ────────────────────────────────────
// Las columnas Decimal de la DB se serializan a number aquí; la forma de
// salida es el contrato `productSchema`. Mantener la serialización en el
// service deja los handlers finos.

type ProductWithStages = Awaited<ReturnType<typeof loadProductWithStages>>;

function loadProductWithStages(id: number) {
  return db.immunotherapyProduct.findUnique({
    where: { id },
    include: { stages: { orderBy: { sortOrder: "asc" } } },
  });
}

function num(d: { toString: () => string } | null | undefined): number | null {
  return d == null ? null : Number(d.toString());
}

function serializeProduct(p: NonNullable<ProductWithStages>): ProductDto {
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

export async function listProducts(): Promise<ProductDto[]> {
  const products = await db.immunotherapyProduct.findMany({
    include: { stages: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return products.map((p) => serializeProduct(p));
}

export async function createProduct(input: CreateProductInput): Promise<ProductDto> {
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
  return serializeProduct(created);
}

export async function updateProduct(input: UpdateProductInput): Promise<ProductDto> {
  const existing = await db.immunotherapyProduct.findUnique({ where: { id: input.id } });
  if (!existing) {
    throw new DomainError("NOT_FOUND", "Producto no encontrado");
  }

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
  return serializeProduct(updated);
}

export async function deleteProduct(id: number): Promise<void> {
  await db.immunotherapyProduct.delete({ where: { id } });
}

// ── Alérgenos (catálogo lite, para el picker) ────────────────────────
export async function listAllergens(q?: string): Promise<AllergenLiteDto[]> {
  const where: Record<string, unknown> = { isActive: true };
  const trimmed = q?.trim();
  if (trimmed) {
    where.OR = [
      { commonName: { contains: trimmed, mode: "insensitive" as const } },
      { scientificName: { contains: trimmed, mode: "insensitive" as const } },
    ];
  }
  return db.clinicalAllergen.findMany({
    where,
    select: { id: true, commonName: true, scientificName: true },
    orderBy: { commonName: "asc" },
    take: 500,
  });
}

// ── Términos económicos + prestador (ClinicSettings singleton) ───────
export async function getTerms(): Promise<ClinicTermsDto> {
  const s = await db.clinicSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return {
    legalName: s.legalName,
    legalRut: s.legalRut,
    immunoBudgetTerms: s.immunoBudgetTerms,
    immunoBudgetIntro: s.immunoBudgetIntro,
  };
}

export async function updateTerms(input: UpdateClinicTermsInput): Promise<ClinicTermsDto> {
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
}

// ── PDF: presupuesto + receta ────────────────────────────────────────
// Carga datos, computa la cotización, ensambla el PDF y devuelve los bytes
// + nombre de archivo. El handler sólo envuelve en un File. Imports pdf-lib
// lazy (≈3MB heap) para no cargarlos hasta el primer /pdf.

type GeneratedPdf = { pdfBytes: Uint8Array; fileName: string };

export async function generateBudgetPdfFile(input: CreateBudgetInput): Promise<GeneratedPdf> {
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: {
      person: { select: { names: true, fatherName: true, motherName: true, rut: true } },
    },
  });
  if (!patient) {
    throw new DomainError("NOT_FOUND", "Paciente no encontrado");
  }

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

  const fullName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
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
  const { generateBudgetPdf } = await import("../modules/immunotherapy/budget-pdf.service.ts");
  const { toPdfA3 } = await import("../modules/pdf/pdf-a.ts");
  const rawPdf = await generateBudgetPdf({
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
      logoUrl: clinic.logoUrl,
    },
    patient: { name: fullName, rut: patient.person.rut },
    quote,
    lab: product?.lab ?? null,
    terms: clinic.immunoBudgetTerms,
    intro,
  });

  const pdfBytes = await toPdfA3(rawPdf, "Presupuesto de inmunoterapia");
  const fileName = `presupuesto_inmunoterapia_${(patient.person.rut ?? "sin_rut").replace(
    /\./g,
    ""
  )}.pdf`;
  return { pdfBytes, fileName };
}

export async function generatePrescriptionPdfFile(
  input: PrescriptionPdfInput
): Promise<GeneratedPdf> {
  const patient = await db.patient.findUnique({
    where: { id: input.patientId },
    select: {
      birthDate: true,
      person: {
        select: {
          names: true,
          fatherName: true,
          motherName: true,
          rut: true,
          email: true,
          phone: true,
        },
      },
    },
  });
  if (!patient) {
    throw new DomainError("NOT_FOUND", "Paciente no encontrado");
  }

  const [quote, clinic, product] = await Promise.all([
    computeQuote(input),
    db.clinicSettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.immunotherapyProduct.findUnique({
      where: { id: input.productId },
      select: { name: true, vaccineProduct: true },
    }),
  ]);
  if (!product) {
    throw new DomainError("NOT_FOUND", "Producto no encontrado");
  }

  const fullName = [patient.person.names, patient.person.fatherName, patient.person.motherName]
    .filter(Boolean)
    .join(" ");

  const { generatePrescriptionPdf } = await import(
    "../modules/immunotherapy/prescription-pdf.service.ts"
  );
  const { toPdfA3 } = await import("../modules/pdf/pdf-a.ts");
  const rawPdf = await generatePrescriptionPdf({
    patient: {
      name: fullName,
      rut: patient.person.rut,
      birthDate: patient.birthDate,
      phone: patient.person.phone,
      email: patient.person.email,
    },
    clinic: {
      doctorName: clinic.doctorName,
      doctorRut: clinic.doctorRut,
      email: clinic.email,
    },
    quote,
    product,
    diagnosis: input.diagnosis,
    observations: input.observations,
  });

  const pdfBytes = await toPdfA3(rawPdf, "Prescripción de inmunoterapia");
  const fileName = `receta_inmunoterapia_${(patient.person.rut ?? "sin_rut").replace(
    /\./g,
    ""
  )}.pdf`;
  return { pdfBytes, fileName };
}
