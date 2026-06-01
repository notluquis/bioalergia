import { db } from "@finanzas/db";
import type {
  CreateQuoteInput,
  QuoteItemInput,
  UpdateQuoteInput,
} from "@finanzas/orpc-contracts/quotes";
import { DomainError } from "../lib/errors.ts";
import { serializeCompany } from "./companies.ts";

const quoteInclude = {
  company: { include: { contacts: { orderBy: { id: "asc" as const } } } },
  contact: true,
  items: { orderBy: { sortOrder: "asc" as const } },
  createdBy: { include: { person: true } },
};

type QuoteWithRelations = NonNullable<Awaited<ReturnType<typeof getQuoteById>>>;

function num(d: { toString: () => string }): number {
  return Number(d.toString());
}

// Subtotal por línea = cantidad × precio − descuento de línea.
function lineSubtotal(item: Pick<QuoteItemInput, "quantity" | "unitPrice" | "discount">): number {
  return Math.max(0, item.quantity * item.unitPrice - (item.discount ?? 0));
}

export type QuoteTotals = {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
};

// IVA 19% sobre la base afecta (líneas no exentas) menos el descuento global.
// Las líneas exentas no tributan. CLP sin decimales (redondeo a entero).
export function computeQuoteTotals(
  items: QuoteItemInput[],
  discount: number,
  taxRate: number
): QuoteTotals {
  let afecto = 0;
  let exento = 0;
  for (const item of items) {
    const sub = lineSubtotal(item);
    if (item.exempt) exento += sub;
    else afecto += sub;
  }
  const subtotal = afecto + exento;
  const afectoNet = Math.max(0, afecto - discount);
  const taxAmount = Math.round((afectoNet * taxRate) / 100);
  const total = afectoNet + exento + taxAmount;
  return { subtotal, discount, taxRate, taxAmount, total };
}

export function serializeQuote(q: QuoteWithRelations) {
  const createdByName = q.createdBy
    ? [q.createdBy.person.names, q.createdBy.person.fatherName].filter(Boolean).join(" ")
    : null;
  return {
    id: q.id,
    folio: q.folio,
    companyId: q.companyId,
    contactId: q.contactId,
    createdById: q.createdById,
    createdByName,
    issueDate: q.issueDate,
    dueDate: q.dueDate,
    condicionPago: q.condicionPago,
    status: q.status,
    subtotal: num(q.subtotal),
    discount: num(q.discount),
    taxRate: num(q.taxRate),
    taxAmount: num(q.taxAmount),
    total: num(q.total),
    comments: q.comments,
    notes: q.notes,
    company: serializeCompany(q.company),
    contact: q.contact
      ? {
          id: q.contact.id,
          companyId: q.contact.companyId,
          personId: q.contact.personId,
          name: q.contact.name,
          email: q.contact.email,
          phone: q.contact.phone,
          role: q.contact.role,
        }
      : null,
    items: q.items.map((it: QuoteWithRelations["items"][number]) => ({
      id: it.id,
      productId: it.productId,
      code: it.code,
      brand: it.brand,
      category: it.category,
      description: it.description,
      format: it.format,
      quantity: num(it.quantity),
      unitPrice: num(it.unitPrice),
      discount: num(it.discount),
      exempt: it.exempt,
      subtotal: num(it.subtotal),
      sortOrder: it.sortOrder,
    })),
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

export async function getQuoteById(id: number) {
  return db.quote.findUnique({ where: { id }, include: quoteInclude });
}

export async function getQuoteOrThrow(id: number) {
  const quote = await getQuoteById(id);
  if (!quote) throw new DomainError("NOT_FOUND", "Cotización no encontrada");
  return quote;
}

export async function listQuotes(filter?: { companyId?: number; q?: string }) {
  const where: Record<string, unknown> = {};
  if (filter?.companyId != null) where.companyId = filter.companyId;
  const trimmed = filter?.q?.trim();
  if (trimmed) {
    where.OR = [
      { company: { razonSocial: { contains: trimmed, mode: "insensitive" as const } } },
      { comments: { contains: trimmed, mode: "insensitive" as const } },
    ];
  }
  const quotes = await db.quote.findMany({
    where,
    include: { company: true, createdBy: { include: { person: true } } },
    orderBy: { folio: "desc" },
    take: 500,
  });
  return quotes.map((q) => ({
    id: q.id,
    folio: q.folio,
    companyId: q.companyId,
    companyName: q.company.razonSocial,
    issueDate: q.issueDate,
    status: q.status,
    total: num(q.total),
    createdByName: q.createdBy
      ? [q.createdBy.person.names, q.createdBy.person.fatherName].filter(Boolean).join(" ")
      : null,
  }));
}

// Snapshot de la línea desde el catálogo (o datos inline si no hay productId).
function itemData(item: QuoteItemInput, index: number) {
  return {
    productId: item.productId ?? null,
    code: item.code ?? null,
    brand: item.brand ?? null,
    category: item.category ?? null,
    description: item.description.trim(),
    format: item.format ?? null,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount ?? 0,
    exempt: item.exempt ?? false,
    subtotal: lineSubtotal(item),
    sortOrder: index,
  };
}

async function validateRefs(companyId: number, contactId: number | null | undefined) {
  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) throw new DomainError("NOT_FOUND", "Empresa no encontrada");
  if (contactId != null) {
    const contact = await db.companyContact.findUnique({ where: { id: contactId } });
    if (!contact || contact.companyId !== companyId) {
      throw new DomainError("BAD_REQUEST", "El contacto no pertenece a la empresa");
    }
  }
}

export async function createQuote(input: CreateQuoteInput, createdById: number | null) {
  await validateRefs(input.companyId, input.contactId);
  const totals = computeQuoteTotals(input.items, input.discount, input.taxRate);

  return db.$transaction(async (tx) => {
    const last = await tx.quote.findFirst({ orderBy: { folio: "desc" }, select: { folio: true } });
    const folio = (last?.folio ?? 0) + 1;

    const created = await tx.quote.create({
      data: {
        folio,
        companyId: input.companyId,
        contactId: input.contactId ?? null,
        createdById,
        issueDate: input.issueDate ? new Date(input.issueDate) : new Date(),
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        condicionPago: input.condicionPago ?? null,
        status: input.status ?? "DRAFT",
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxRate: totals.taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        comments: input.comments ?? null,
        notes: input.notes ?? null,
        items: { create: input.items.map((it, i) => itemData(it, i)) },
      },
      include: quoteInclude,
    });
    return created;
  });
}

export async function updateQuote(input: UpdateQuoteInput) {
  const { id, items, ...rest } = input;
  const existing = await getQuoteOrThrow(id);
  const companyId = rest.companyId ?? existing.companyId;
  const contactId = rest.contactId === undefined ? existing.contactId : rest.contactId;
  await validateRefs(companyId, contactId);

  const data: Record<string, unknown> = {};
  if (rest.companyId !== undefined) data.companyId = rest.companyId;
  if (rest.contactId !== undefined) data.contactId = rest.contactId;
  if (rest.condicionPago !== undefined) data.condicionPago = rest.condicionPago;
  if (rest.comments !== undefined) data.comments = rest.comments;
  if (rest.notes !== undefined) data.notes = rest.notes;
  if (rest.status !== undefined) data.status = rest.status;
  if (rest.issueDate !== undefined) data.issueDate = new Date(rest.issueDate);
  if (rest.dueDate !== undefined) data.dueDate = rest.dueDate ? new Date(rest.dueDate) : null;

  // Si vienen items, recalcula totales y reemplaza líneas.
  if (items !== undefined) {
    const discount = rest.discount ?? Number(existing.discount.toString());
    const taxRate = rest.taxRate ?? Number(existing.taxRate.toString());
    const totals = computeQuoteTotals(items, discount, taxRate);
    Object.assign(data, totals);
  } else if (rest.discount !== undefined || rest.taxRate !== undefined) {
    // Recalcular sobre líneas existentes si cambió descuento/IVA.
    const currentItems: QuoteItemInput[] = existing.items.map(
      (it: QuoteWithRelations["items"][number]) => ({
        quantity: Number(it.quantity.toString()),
        unitPrice: Number(it.unitPrice.toString()),
        discount: Number(it.discount.toString()),
        exempt: it.exempt,
        description: it.description,
      })
    );
    const discount = rest.discount ?? Number(existing.discount.toString());
    const taxRate = rest.taxRate ?? Number(existing.taxRate.toString());
    Object.assign(data, computeQuoteTotals(currentItems, discount, taxRate));
  }

  return db.$transaction(async (tx) => {
    if (items !== undefined) {
      await tx.quoteItem.deleteMany({ where: { quoteId: id } });
      data.items = { create: items.map((it, i) => itemData(it, i)) };
    }
    return tx.quote.update({ where: { id }, data, include: quoteInclude });
  });
}

export async function deleteQuote(id: number) {
  await getQuoteOrThrow(id);
  await db.quote.delete({ where: { id } });
}
