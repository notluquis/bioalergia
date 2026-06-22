import { db } from "@finanzas/db";
import type {
  CreateOccupationalLeadInput,
  OccupationalLeadStatus,
} from "@finanzas/orpc-contracts/occupational";
import { DomainError } from "../lib/errors.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { loadSettings } from "../lib/settings.ts";
import { sendReactivoLeadNotification } from "./email/transactional.ts";

type OccLeadRow = NonNullable<Awaited<ReturnType<typeof db.occupationalLead.findFirst>>>;

export function serializeOccupationalLead(l: OccLeadRow) {
  return {
    id: l.id,
    empresa: l.empresa,
    contactName: l.contactName,
    email: l.email,
    phone: l.phone,
    rut: l.rut,
    sector: l.sector,
    headcount: l.headcount,
    message: l.message,
    status: l.status,
    source: l.source,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  };
}

/**
 * Crea un lead de salud ocupacional desde el landing público. Honeypot: si
 * `website` trae contenido se descarta silencioso. El email al equipo es
 * best-effort (reusa la notificación de leads B2B + el destinatario configurado).
 */
export async function createOccupationalLead(input: CreateOccupationalLeadInput) {
  if (input.website && input.website.length > 0) {
    return { ok: true as const, id: 0 };
  }
  const lead = await db.occupationalLead.create({
    data: {
      empresa: input.empresa.trim(),
      contactName: input.contactName.trim(),
      email: input.email.trim(),
      phone: input.phone?.trim() || null,
      rut: input.rut?.trim() || null,
      sector: input.sector,
      headcount: input.headcount ?? null,
      message: input.message?.trim() || null,
      source: "salud-ocupacional",
    },
  });

  try {
    const settings = await loadSettings();
    const context = [
      `Salud ocupacional · sector ${lead.sector}`,
      lead.headcount ? `${lead.headcount} trabajadores` : null,
      lead.message,
    ]
      .filter(Boolean)
      .join(" · ");
    await sendReactivoLeadNotification({
      to: settings.reactivoLeadsEmail,
      lead: {
        id: lead.id,
        empresa: lead.empresa,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        rut: lead.rut,
        message: context,
        productsOfInterest: [],
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "occupational.lead.notify", leadId: lead.id });
  }
  logEvent("[occupational] lead created", { id: lead.id, empresa: lead.empresa });
  return { ok: true as const, id: lead.id };
}

export async function listOccupationalLeads() {
  return db.occupationalLead.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
}

export async function updateOccupationalLeadStatus(id: number, status: OccupationalLeadStatus) {
  const existing = await db.occupationalLead.findUnique({ where: { id } });
  if (!existing) throw new DomainError("NOT_FOUND", "Lead no encontrado");
  return db.occupationalLead.update({ where: { id }, data: { status } });
}
