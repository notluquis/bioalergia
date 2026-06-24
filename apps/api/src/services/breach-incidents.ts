import { db } from "@finanzas/db";
import type {
  createBreachIncidentInputSchema,
  updateBreachIncidentInputSchema,
} from "@finanzas/orpc-contracts/breach-incidents";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type ListInput = { status?: string };
type CreateInput = z.infer<typeof createBreachIncidentInputSchema>;
type UpdateInput = z.infer<typeof updateBreachIncidentInputSchema>;

/**
 * Incidentes de brecha de datos personales (Ley 21.719). El equipo registra el
 * incidente al detectarlo y va marcando los hitos de notificación (Agencia +
 * titulares). El plazo de notificación a la Agencia corre desde detectedAt.
 */
export async function listBreachIncidents(input: ListInput): Promise<{
  incidents: Awaited<ReturnType<typeof db.breachIncident.findMany>>;
}> {
  const incidents = await db.breachIncident.findMany({
    where: input.status ? { status: input.status } : undefined,
    orderBy: { detectedAt: "desc" },
  });
  return { incidents };
}

export async function createBreachIncident(input: CreateInput) {
  const detectedAt = new Date(input.detectedAt);
  if (Number.isNaN(detectedAt.getTime())) {
    throw new DomainError("BAD_REQUEST", "Fecha de detección inválida");
  }
  return db.breachIncident.create({
    data: {
      detectedAt,
      description: input.description,
      severity: input.severity,
      affectedData: input.affectedData ?? null,
      affectedCount: input.affectedCount ?? null,
    },
  });
}

export async function updateBreachIncident(input: UpdateInput) {
  const found = await db.breachIncident.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Incidente de brecha no encontrado");

  const data: {
    status?: string;
    agencyNotifiedAt?: Date | null;
    subjectsNotifiedAt?: Date | null;
    notes?: string | null;
  } = {};

  if (input.status !== undefined) data.status = input.status;
  if (input.agencyNotifiedAt !== undefined) {
    data.agencyNotifiedAt = coerceDate(
      input.agencyNotifiedAt,
      "Fecha de notificación a la Agencia inválida"
    );
  }
  if (input.subjectsNotifiedAt !== undefined) {
    data.subjectsNotifiedAt = coerceDate(
      input.subjectsNotifiedAt,
      "Fecha de notificación a titulares inválida"
    );
  }
  if (input.notes !== undefined) data.notes = input.notes;

  return db.breachIncident.update({ where: { id: input.id }, data });
}

function coerceDate(value: string | null, errorMsg: string): Date | null {
  if (value === null) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new DomainError("BAD_REQUEST", errorMsg);
  }
  return parsed;
}
