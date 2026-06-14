// Lógica de negocio de broadcasts de WhatsApp Cloud, fuera de los handlers
// oRPC (golden 2026: handlers finos). Los servicios validan y lanzan
// DomainError (mapeado a HTTP por orpc/error.ts::toORPCError); los handlers
// quedan: authz → [enqueue de la cola] → service → return.
//
// IMPORTANTE: el disparo de la cola (enqueueJob de send_wa_broadcast_tick)
// se queda en el handler — es un trigger de cola, no lógica de DB. Estos
// servicios devuelven la fila creada/actualizada para que el handler decida
// el enqueue (status, scheduledAt, id).

import { db } from "@finanzas/db";
import type {
  broadcastDetailResponseSchema,
  createBroadcastInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";

type CreateBroadcastPayload = z.infer<typeof createBroadcastInputSchema>;

type BroadcastRow = Awaited<ReturnType<typeof db.waBroadcast.create>>;

// Crea el broadcast + sus recipients. status = QUEUED si viene con scheduledAt
// (la cadena de drain arranca a su hora), DRAFT si no (espera startBroadcast).
export async function createBroadcast(
  payload: CreateBroadcastPayload,
  createdByUserId: number
): Promise<BroadcastRow> {
  return db.waBroadcast.create({
    data: {
      accountId: payload.accountId,
      phoneNumberId: payload.phoneNumberId,
      name: payload.name,
      templateName: payload.templateName,
      templateLanguage: payload.templateLanguage,
      scheduledAt: payload.scheduledAt ?? null,
      rateLimitPerSecond: payload.rateLimitPerSecond,
      totalRecipients: payload.recipients.length,
      createdByUserId,
      status: payload.scheduledAt ? "QUEUED" : "DRAFT",
      recipients: {
        create: payload.recipients.map((r) => ({
          phoneE164: r.phoneE164,
          variables: r.variables as never,
        })),
      },
    },
  });
}

export async function listBroadcasts(): Promise<{ broadcasts: BroadcastRow[] }> {
  const rows = await db.waBroadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { broadcasts: rows };
}

type BroadcastDetail = z.infer<typeof broadcastDetailResponseSchema>;

export async function getBroadcastDetail(id: number): Promise<BroadcastDetail> {
  const bc = await db.waBroadcast.findUnique({ where: { id } });
  if (!bc) throw new DomainError("NOT_FOUND", "Broadcast no encontrado");
  const recipients = await db.waBroadcastRecipient.findMany({
    where: { broadcastId: bc.id },
    orderBy: { id: "asc" },
    take: 1000,
  });
  return {
    broadcast: bc as unknown as BroadcastDetail["broadcast"],
    recipients: recipients.map((r) => ({
      ...r,
      variables: (r.variables as unknown as string[]) ?? [],
    })) as unknown as BroadcastDetail["recipients"],
  };
}

// Marca el broadcast como QUEUED (o reinicia la cadena). Valida que esté en un
// estado iniciable. Devuelve la fila actualizada para que el handler encole la
// cadena de drain con runAt = scheduledAt.
export async function startBroadcast(id: number): Promise<BroadcastRow> {
  const bc = await db.waBroadcast.findUnique({ where: { id } });
  if (!bc) throw new DomainError("NOT_FOUND", "Broadcast no encontrado");
  if (bc.status !== "DRAFT" && bc.status !== "QUEUED") {
    throw new DomainError("BAD_REQUEST", `Estado ${bc.status} no permite iniciar`);
  }
  return db.waBroadcast.update({
    where: { id: bc.id },
    data: { status: "QUEUED", scheduledAt: bc.scheduledAt ?? new Date() },
  });
}

export async function cancelBroadcast(id: number): Promise<void> {
  await db.waBroadcast.update({
    where: { id },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  await db.waBroadcastRecipient.updateMany({
    where: { broadcastId: id, status: "PENDING" },
    data: { status: "SKIPPED", errorMessage: "Broadcast cancelado" },
  });
}

export type { BroadcastRow };
