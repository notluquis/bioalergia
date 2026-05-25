import { db } from "@finanzas/db";
import type {
  CreateBudgetInput,
  QuoteInput,
  QuoteResult,
} from "@finanzas/orpc-contracts/immunotherapy";
import { Decimal } from "decimal.js";
import { DomainError } from "../lib/errors.ts";

// Lógica de presupuesto de inmunoterapia (ITA), fuera de los handlers oRPC.
// El service valida, calcula el desglose y lanza DomainError (mapeado a HTTP
// por orpc/error.ts). Los precios/etapas viven 100% en DB (ImmunotherapyProduct
// + ImmunotherapyDoseStage); aquí no hay montos hardcodeados.

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
