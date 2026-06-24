import { db } from "@finanzas/db";
import type {
  CreatePublicComplaintInput,
  CreatePublicContactInput,
  CreatePublicDataRightsInput,
} from "@finanzas/orpc-contracts/public-clinic";
import { logError, logEvent } from "../lib/logger.ts";
import { loadSettings } from "../lib/settings.ts";
import { createComplaint } from "./complaints.ts";
import { createDataRightsRequest } from "./data-rights.ts";
import {
  sendPublicComplaintNotification,
  sendPublicContactNotification,
  sendPublicDataRightsNotification,
} from "./email/transactional.ts";

const OK = { ok: true as const };

/**
 * Lista de precios PÚBLICA (Ley 20.584, arancel a la vista). Devuelve sólo los
 * ítems activos y sólo los campos públicos (sin id interno, code, flags). El
 * `updatedAt` agregado permite mostrar "vigente al ..." en el sitio.
 */
export async function listPublicPriceList(): Promise<{
  items: Array<{
    name: string;
    category: string;
    unit: string;
    priceClp: number;
    notes: string | null;
  }>;
  updatedAt: Date | null;
}> {
  const rows = await db.priceListItem.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      name: true,
      category: true,
      unit: true,
      priceClp: true,
      notes: true,
      updatedAt: true,
    },
  });
  const updatedAt = rows.reduce<Date | null>(
    (acc, r) => (acc === null || r.updatedAt > acc ? r.updatedAt : acc),
    null
  );
  return {
    items: rows.map((r) => ({
      name: r.name,
      category: r.category,
      unit: r.unit,
      priceClp: r.priceClp,
      notes: r.notes,
    })),
    updatedAt,
  };
}

/** Inbox que recibe los avisos de los formularios públicos (configurable). */
async function notifyInbox(): Promise<string> {
  const settings = await loadSettings();
  return settings.emailReplyTo;
}

/**
 * Reclamo público (Decreto 35/2012). Honeypot: si `website` trae contenido, es
 * un bot -> se descarta en silencio (no persiste, no notifica). Persiste vía el
 * servicio admin con canal WEB (mismo cómputo de plazo de 15 días hábiles). El
 * correo al equipo es best-effort: si Resend falla, el reclamo igual queda.
 */
export async function createPublicComplaint(input: CreatePublicComplaintInput) {
  if (input.website && input.website.length > 0) return OK;

  const complaint = await createComplaint({
    channel: "WEB",
    complainantName: input.complainantName.trim(),
    complainantRut: input.complainantRut?.trim() || undefined,
    contact: input.contact.trim(),
    category: input.category?.trim() || undefined,
    description: input.description.trim(),
  });

  try {
    await sendPublicComplaintNotification({
      to: await notifyInbox(),
      complaint: {
        id: complaint.id,
        complainantName: complaint.complainantName,
        contact: complaint.contact,
        category: complaint.category,
        description: complaint.description,
        dueAt: complaint.dueAt,
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "public.complaint.notify", id: complaint.id });
  }
  logEvent("[public] complaint created", { id: complaint.id });
  return OK;
}

/**
 * Ejercicio de derechos del titular (Ley 21.719). Honeypot igual que arriba.
 * Persiste vía el servicio admin (plazo de 30 días corridos). El email lleva el
 * tipo de derecho ejercido para que el equipo verifique identidad y responda.
 */
export async function createPublicDataRightsRequest(input: CreatePublicDataRightsInput) {
  if (input.website && input.website.length > 0) return OK;

  const request = await createDataRightsRequest({
    type: input.type,
    requesterName: input.requesterName.trim(),
    requesterRut: input.requesterRut?.trim() || undefined,
    requesterEmail: input.requesterEmail.trim(),
    notes: input.notes?.trim() || undefined,
  });

  try {
    await sendPublicDataRightsNotification({
      to: await notifyInbox(),
      request: {
        id: request.id,
        type: request.type,
        requesterName: request.requesterName,
        requesterEmail: request.requesterEmail,
        requesterRut: request.requesterRut,
        dueAt: request.dueAt,
        notes: request.notes,
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "public.data-rights.notify", id: request.id });
  }
  logEvent("[public] data-rights request created", { id: request.id, type: request.type });
  return OK;
}

/**
 * Contacto general. NO persiste (minimización Ley 21.719): el formulario público
 * no pide datos de salud y no abre ficha. Sólo notifica al equipo por correo.
 * Requiere consentimiento explícito (validado en el contrato, `consent` literal
 * true). Honeypot igual que arriba.
 */
export async function createPublicContact(input: CreatePublicContactInput) {
  if (input.website && input.website.length > 0) return OK;

  try {
    await sendPublicContactNotification({
      to: await notifyInbox(),
      contact: {
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || null,
        message: input.message.trim(),
      },
    });
  } catch (err) {
    logError(err, { module: "api", operation: "public.contact.notify" });
    // El contacto no se persiste: si el correo falla, propagamos el error para
    // que el usuario reintente (no hay registro de respaldo como en reclamos).
    throw err;
  }
  logEvent("[public] contact message sent", { email: input.email });
  return OK;
}
