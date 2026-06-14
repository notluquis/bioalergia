// Lógica de webhook-logs / account-events / phone-health-snapshot / quality-
// summary de WhatsApp Cloud, fuera de los handlers oRPC (golden 2026: handlers
// finos). Validan, hacen queries y lanzan DomainError (mapeado a HTTP por
// orpc/error.ts::toORPCError). La llamada al Graph client de Meta (getPhoneHealth)
// se conserva intacta; el snapshot best-effort de qualityRating mantiene su
// try/catch + logError tal cual.

import { db } from "@finanzas/db";
import type {
  acknowledgeAccountEventInputSchema,
  listAccountEventsInputSchema,
  listAccountEventsResponseSchema,
  listWebhookLogsInputSchema,
  listWebhookLogsResponseSchema,
  phoneHealthResponseSchema,
  phoneQualitySummaryInputSchema,
  phoneQualitySummaryResponseSchema,
  waPhoneIdInput,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { logError } from "../lib/logger.ts";
import { getPhoneHealth as getPhoneHealthGraph } from "../modules/wa-cloud/graph-client.ts";

type ListWebhookLogsPayload = z.infer<typeof listWebhookLogsInputSchema>;
type ListWebhookLogsResponse = z.infer<typeof listWebhookLogsResponseSchema>;
type ListAccountEventsPayload = z.infer<typeof listAccountEventsInputSchema>;
type ListAccountEventsResponse = z.infer<typeof listAccountEventsResponseSchema>;
type AcknowledgeAccountEventPayload = z.infer<typeof acknowledgeAccountEventInputSchema>;
type PhoneIdPayload = z.infer<typeof waPhoneIdInput>;
type PhoneHealthResponse = z.infer<typeof phoneHealthResponseSchema>;
type PhoneQualitySummaryPayload = z.infer<typeof phoneQualitySummaryInputSchema>;
type PhoneQualitySummaryResponse = z.infer<typeof phoneQualitySummaryResponseSchema>;

export async function listWebhookLogs(
  payload: ListWebhookLogsPayload
): Promise<ListWebhookLogsResponse> {
  const where = payload.onlyInvalid ? { signatureValid: false } : {};
  const logs = await db.waWebhookLog.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    take: payload.limit,
  });
  return {
    logs: logs.map((l: (typeof logs)[number]) => {
      const payloadJson = l.payload as {
        entry?: Array<{ changes?: Array<{ field?: string }> }>;
        object?: string;
      } | null;
      const fields: string[] = [];
      for (const e of payloadJson?.entry ?? []) {
        for (const c of e.changes ?? []) {
          if (c.field) fields.push(c.field);
        }
      }
      const preview = JSON.stringify(payloadJson).slice(0, 200);
      return {
        id: l.id,
        receivedAt: l.receivedAt,
        signatureValid: l.signatureValid,
        processed: l.processed,
        eventCount: l.eventCount,
        errorMessage: l.errorMessage,
        fields: Array.from(new Set(fields)),
        preview,
      };
    }),
  } as unknown as ListWebhookLogsResponse;
}

export async function listAccountEvents(
  payload: ListAccountEventsPayload
): Promise<ListAccountEventsResponse> {
  const where: Record<string, unknown> = {};
  if (payload.acknowledged !== undefined) where.acknowledged = payload.acknowledged;
  if (payload.severity) where.severity = payload.severity;
  const [events, unacknowledgedCount] = await Promise.all([
    db.waAccountEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: payload.limit,
    }),
    db.waAccountEvent.count({ where: { acknowledged: false } }),
  ]);
  return { events, unacknowledgedCount } as unknown as ListAccountEventsResponse;
}

export async function acknowledgeAccountEvent(
  payload: AcknowledgeAccountEventPayload,
  acknowledgedByUserId: number
): Promise<void> {
  await db.waAccountEvent.update({
    where: { id: payload.id },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedByUserId,
    },
  });
}

export async function getPhoneHealth(payload: PhoneIdPayload): Promise<PhoneHealthResponse> {
  const h = await getPhoneHealthGraph(payload.phoneNumberId);
  // Persist quality_rating snapshot for offline charts.
  try {
    if (h.quality_rating) {
      await db.waPhoneNumber.update({
        where: { id: payload.phoneNumberId },
        data: { qualityRating: h.quality_rating },
      });
    }
  } catch (err) {
    logError("[wa-cloud.getPhoneHealth] persist failed", { err });
  }
  return h;
}

export async function getPhoneQualitySummary(
  payload: PhoneQualitySummaryPayload
): Promise<PhoneQualitySummaryResponse> {
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: payload.phoneNumberId },
    select: { id: true, qualityRating: true },
  });
  if (!phone) {
    throw new DomainError("NOT_FOUND", "Phone no encontrado");
  }
  const [critical, warning, last] = await Promise.all([
    db.waAccountEvent.count({
      where: {
        phoneNumberId: payload.phoneNumberId,
        severity: "critical",
        acknowledged: false,
      },
    }),
    db.waAccountEvent.count({
      where: {
        phoneNumberId: payload.phoneNumberId,
        severity: "warning",
        acknowledged: false,
      },
    }),
    db.waAccountEvent.findFirst({
      where: { phoneNumberId: payload.phoneNumberId },
      orderBy: { receivedAt: "desc" },
      select: { receivedAt: true },
    }),
  ]);
  const allowed = ["GREEN", "YELLOW", "RED"] as const;
  const rating =
    phone.qualityRating && (allowed as readonly string[]).includes(phone.qualityRating)
      ? (phone.qualityRating as "GREEN" | "YELLOW" | "RED")
      : null;
  return {
    phoneNumberId: phone.id,
    qualityRating: rating,
    criticalUnacknowledged: critical,
    warningUnacknowledged: warning,
    lastEventAt: last?.receivedAt ?? null,
  };
}
