import { db } from "@finanzas/db";
import type {
  dataRightsCreateInputSchema,
  dataRightsListInputSchema,
  dataRightsResolveInputSchema,
} from "@finanzas/orpc-contracts/data-rights";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type ListInput = z.infer<typeof dataRightsListInputSchema>;
type CreateInput = z.infer<typeof dataRightsCreateInputSchema>;
type ResolveInput = z.infer<typeof dataRightsResolveInputSchema>;

// plazo legal de respuesta configurable
// Ley 21.719 obliga a responder las solicitudes de derechos del titular dentro
// de un plazo; lo modelamos como 30 días corridos desde la recepción.
const RESPONSE_DAYS = 30;

const DAY_MS = 86_400_000;

/**
 * dueAt = receivedAt + RESPONSE_DAYS días corridos. El campo `received_at` es
 * un `DateTime` (instante, no `@db.Date`), por lo que sumar N días en
 * milisegundos respeta el plazo legal sin saltos de huso.
 */
function computeDueAt(receivedAt: Date): Date {
  return new Date(receivedAt.getTime() + RESPONSE_DAYS * DAY_MS);
}

/**
 * Solicitudes de derechos del titular (Ley 21.719): Acceso, Rectificación,
 * Cancelación (DELETION), Portabilidad, Oposición y Bloqueo. Esta capa es la
 * admin (recepción + seguimiento + resolución) consumida por la intranet.
 */
export async function listDataRightsRequests(input: ListInput): Promise<{
  requests: Awaited<ReturnType<typeof db.dataRightsRequest.findMany>>;
}> {
  const requests = await db.dataRightsRequest.findMany({
    where: input.status ? { status: input.status } : undefined,
    orderBy: { dueAt: "asc" },
  });
  return { requests };
}

export async function createDataRightsRequest(input: CreateInput) {
  // receivedAt usa el default now() de la BD; lo leemos para derivar dueAt en
  // el mismo instante (evita drift entre el default de BD y el cálculo).
  const receivedAt = new Date();
  return db.dataRightsRequest.create({
    data: {
      type: input.type,
      requesterName: input.requesterName,
      requesterRut: input.requesterRut ?? null,
      requesterEmail: input.requesterEmail ?? null,
      patientId: input.patientId ?? null,
      receivedAt,
      dueAt: computeDueAt(receivedAt),
      notes: input.notes ?? null,
    },
  });
}

export async function resolveDataRightsRequest(input: ResolveInput) {
  const found = await db.dataRightsRequest.findUnique({
    where: { id: input.id },
    select: { id: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Solicitud de derechos no encontrada");

  // RESOLVED/REJECTED son estados terminales -> sellar resolvedAt; IN_PROGRESS
  // reabre el seguimiento -> limpiar resolvedAt.
  const isTerminal = input.status === "RESOLVED" || input.status === "REJECTED";
  return db.dataRightsRequest.update({
    where: { id: input.id },
    data: {
      status: input.status,
      resolution: input.resolution ?? null,
      resolvedAt: isTerminal ? new Date() : null,
    },
  });
}

/**
 * Prórroga única (+30 días corridos sobre el `dueAt` actual), permitida por la
 * Ley 21.719 "por una vez". `extendedAt` sella su uso: una solicitud ya
 * prorrogada o cerrada (RESOLVED/REJECTED) no admite otra prórroga.
 */
export async function extendDataRightsRequest(id: string) {
  const found = await db.dataRightsRequest.findUnique({
    where: { id },
    select: { id: true, status: true, dueAt: true, extendedAt: true },
  });
  if (!found) throw new DomainError("NOT_FOUND", "Solicitud de derechos no encontrada");
  if (found.status === "RESOLVED" || found.status === "REJECTED") {
    throw new DomainError("BAD_REQUEST", "No se puede prorrogar una solicitud ya cerrada");
  }
  if (found.extendedAt) {
    throw new DomainError(
      "BAD_REQUEST",
      "La solicitud ya fue prorrogada una vez (máximo legal alcanzado)"
    );
  }

  const now = new Date();
  return db.dataRightsRequest.update({
    where: { id },
    data: {
      dueAt: new Date(found.dueAt.getTime() + RESPONSE_DAYS * DAY_MS),
      extendedAt: now,
      // La prórroga implica que el trámite sigue en curso.
      status: found.status === "RECEIVED" ? "IN_PROGRESS" : found.status,
    },
  });
}
