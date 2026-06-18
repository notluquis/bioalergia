import { db } from "@finanzas/db";
import type {
  CreateReactivoLeadInput,
  ReactivoLeadStatus,
} from "@finanzas/orpc-contracts/reactivos";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { loadSettings } from "../lib/settings.ts";
import { sendReactivoLeadNotification } from "./email/transactional.ts";

// ── Vitrina pública (SIN precio) ─────────────────────────────────────
const vitrinaInclude = {
  allergen: {
    select: { id: true, commonName: true, scientificName: true, category: true },
  },
} as const;

type VitrinaRow = Awaited<
  ReturnType<typeof db.quoteProduct.findMany<{ include: typeof vitrinaInclude }>>
>[number];

export function serializeVitrinaItem(p: VitrinaRow) {
  // NO se expone `unitPrice`: la vitrina pública nunca devuelve precios.
  return {
    id: p.id,
    slug: p.slug,
    code: p.code,
    brand: p.brand,
    category: p.category,
    name: p.name,
    format: p.format,
    description: p.description,
    imageUrl: p.imageUrl,
    allergen: p.allergen
      ? {
          id: p.allergen.id,
          commonName: p.allergen.commonName,
          scientificName: p.allergen.scientificName,
          category: p.allergen.category,
        }
      : null,
  };
}

export async function listVitrina() {
  return db.quoteProduct.findMany({
    where: { publishedOnSite: true, isActive: true },
    include: vitrinaInclude,
    orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { name: "asc" }],
  });
}

// ── Lead público ─────────────────────────────────────────────────────
type LeadRow = NonNullable<Awaited<ReturnType<typeof db.reactivoLead.findFirst>>>;

export function serializeLead(l: LeadRow) {
  return {
    id: l.id,
    empresa: l.empresa,
    contactName: l.contactName,
    email: l.email,
    phone: l.phone,
    rut: l.rut,
    message: l.message,
    productsOfInterest: l.productsOfInterest,
    status: l.status,
    source: l.source,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

/**
 * Crea un lead desde la vitrina pública. Honeypot: si `website` trae contenido
 * → es un bot, se descarta silencioso devolviendo un id falso (no se persiste ni
 * se notifica, para no avisarle al bot). El email al equipo es best-effort: si
 * Resend falla, el lead igual queda persistido.
 */
export async function createLead(input: CreateReactivoLeadInput) {
  if (input.website && input.website.length > 0) {
    return { ok: true as const, id: 0 };
  }
  const lead = await db.reactivoLead.create({
    data: {
      empresa: input.empresa.trim(),
      contactName: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      rut: input.rut?.trim() || null,
      message: input.message?.trim() || null,
      productsOfInterest: input.productsOfInterest,
      source: "venta-empresas",
    },
  });

  try {
    const settings = await loadSettings();
    await sendReactivoLeadNotification({
      to: settings.reactivoLeadsEmail,
      lead: {
        id: lead.id,
        empresa: lead.empresa,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        rut: lead.rut,
        message: lead.message,
        productsOfInterest: lead.productsOfInterest,
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "reactivos.lead.notify", leadId: lead.id });
  }
  logEvent("[reactivos] lead created", { id: lead.id, empresa: lead.empresa });
  return { ok: true as const, id: lead.id };
}

// ── Bandeja staff ────────────────────────────────────────────────────
export async function listLeads() {
  return db.reactivoLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
}

export async function updateLeadStatus(id: number, status: ReactivoLeadStatus) {
  const existing = await db.reactivoLead.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Lead no encontrado");
  return db.reactivoLead.update({ where: { id }, data: { status } });
}
