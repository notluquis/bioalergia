// Lógica de catálogo de entidades guardadas de WhatsApp Cloud (ubicaciones,
// listas interactivas, flows) + envío vía entidad guardada, fuera de los
// handlers oRPC (golden 2026: handlers finos). Validan, hacen queries y lanzan
// DomainError (mapeado a HTTP por orpc/error.ts::toORPCError). Las llamadas al
// Graph client de Meta (sendLocationMessage/sendInteractiveListMessage/
// sendFlowMessage/listAccountFlows) se conservan intactas.

import { db } from "@finanzas/db";
import type {
  savedFlowSchema,
  savedInteractiveListSchema,
  savedLocationSchema,
  sendMessageResponseSchema,
  sendSavedFlowInputSchema,
  sendSavedListInputSchema,
  sendSavedLocationInputSchema,
  syncFlowsInputSchema,
  syncFlowsResponseSchema,
  upsertSavedFlowInputSchema,
  upsertSavedInteractiveListInputSchema,
  upsertSavedLocationInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import {
  listAccountFlows,
  sendFlowMessage,
  sendInteractiveListMessage,
  sendLocationMessage,
} from "../modules/wa-cloud/graph-client.ts";

const WINDOW_HOURS = 24;

type SavedLocation = z.infer<typeof savedLocationSchema>;
type SavedInteractiveList = z.infer<typeof savedInteractiveListSchema>;
type SavedFlow = z.infer<typeof savedFlowSchema>;
type UpsertSavedLocationPayload = z.infer<typeof upsertSavedLocationInputSchema>;
type UpsertSavedListPayload = z.infer<typeof upsertSavedInteractiveListInputSchema>;
type UpsertSavedFlowPayload = z.infer<typeof upsertSavedFlowInputSchema>;
type SyncFlowsPayload = z.infer<typeof syncFlowsInputSchema>;
type SyncFlowsResponse = z.infer<typeof syncFlowsResponseSchema>;
type SendSavedLocationPayload = z.infer<typeof sendSavedLocationInputSchema>;
type SendSavedListPayload = z.infer<typeof sendSavedListInputSchema>;
type SendSavedFlowPayload = z.infer<typeof sendSavedFlowInputSchema>;
type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

type ListSections = Array<{
  title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}>;

function windowOpen(lastInbound: Date | null): boolean {
  return lastInbound ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000 : false;
}

// ── Saved locations ──────────────────────────────────────────────────────────
export async function listSavedLocations(): Promise<{ locations: SavedLocation[] }> {
  const rows = await db.waSavedLocation.findMany({
    where: { archived: false },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  return { locations: rows } as unknown as { locations: SavedLocation[] };
}

export async function upsertSavedLocation(
  payload: UpsertSavedLocationPayload,
  createdByUserId: number
): Promise<SavedLocation> {
  if (payload.isDefault) {
    await db.waSavedLocation.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
  const row = payload.id
    ? await db.waSavedLocation.update({
        where: { id: payload.id },
        data: {
          name: payload.name,
          latitude: payload.latitude,
          longitude: payload.longitude,
          address: payload.address ?? null,
          isDefault: payload.isDefault,
        },
      })
    : await db.waSavedLocation.create({
        data: {
          name: payload.name,
          latitude: payload.latitude,
          longitude: payload.longitude,
          address: payload.address ?? null,
          isDefault: payload.isDefault,
          createdByUserId,
        },
      });
  return row as unknown as SavedLocation;
}

export async function archiveSavedLocation(id: number): Promise<void> {
  await db.waSavedLocation.update({ where: { id }, data: { archived: true } });
}

// ── Saved interactive lists ──────────────────────────────────────────────────
export async function listSavedInteractiveLists(): Promise<{ lists: SavedInteractiveList[] }> {
  const rows = await db.waSavedInteractiveList.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  return {
    lists: rows.map((r: (typeof rows)[number]) => ({
      ...r,
      sections: (r.sections as unknown as ListSections) ?? [],
    })),
  } as unknown as { lists: SavedInteractiveList[] };
}

export async function upsertSavedInteractiveList(
  payload: UpsertSavedListPayload,
  createdByUserId: number
): Promise<SavedInteractiveList> {
  const data = {
    name: payload.name,
    description: payload.description ?? null,
    headerText: payload.headerText ?? null,
    bodyText: payload.bodyText,
    footerText: payload.footerText ?? null,
    buttonText: payload.buttonText,
    sections: payload.sections as never,
  };
  const row = payload.id
    ? await db.waSavedInteractiveList.update({ where: { id: payload.id }, data })
    : await db.waSavedInteractiveList.create({
        data: { ...data, createdByUserId },
      });
  return {
    ...row,
    sections: (row.sections as unknown as ListSections) ?? [],
  } as unknown as SavedInteractiveList;
}

export async function archiveSavedInteractiveList(id: number): Promise<void> {
  await db.waSavedInteractiveList.update({ where: { id }, data: { archived: true } });
}

// ── Saved flows ──────────────────────────────────────────────────────────────
export async function listSavedFlows(): Promise<{ flows: SavedFlow[] }> {
  const rows = await db.waSavedFlow.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  return { flows: rows } as unknown as { flows: SavedFlow[] };
}

export async function upsertSavedFlow(
  payload: UpsertSavedFlowPayload,
  createdByUserId: number
): Promise<SavedFlow> {
  const data = {
    accountId: payload.accountId ?? null,
    name: payload.name,
    description: payload.description ?? null,
    flowId: payload.flowId,
    flowToken: payload.flowToken ?? null,
    initialScreen: payload.initialScreen ?? null,
    defaultBody: payload.defaultBody,
    defaultHeader: payload.defaultHeader ?? null,
    defaultFooter: payload.defaultFooter ?? null,
    defaultCta: payload.defaultCta,
  };
  const row = payload.id
    ? await db.waSavedFlow.update({ where: { id: payload.id }, data })
    : await db.waSavedFlow.create({
        data: { ...data, createdByUserId },
      });
  return row as unknown as SavedFlow;
}

export async function syncFlows(
  payload: SyncFlowsPayload,
  createdByUserId: number
): Promise<SyncFlowsResponse> {
  const remote = await listAccountFlows(payload.accountId);
  const now = new Date();
  // Batch existing rows for all remote flow ids in one query.
  const existingRows = await db.waSavedFlow.findMany({
    where: { flowId: { in: remote.map((f) => f.id) } },
  });
  const existingById = new Map(existingRows.map((r: (typeof existingRows)[number]) => [r.flowId, r]));
  await Promise.all(
    remote.map((f) => {
      const existing = existingById.get(f.id);
      const meta = {
        metaStatus: f.status ?? null,
        metaCategories: f.categories ?? [],
        metaHealth: f.health?.can_send_message ?? null,
        metaSyncedAt: now,
      };
      return existing
        ? db.waSavedFlow.update({
            where: { flowId: f.id },
            data: {
              ...meta,
              accountId: existing.accountId ?? payload.accountId,
              // Refresh display name unless user customized it.
              name: existing.name === existing.flowId ? f.name : existing.name,
            },
          })
        : db.waSavedFlow.create({
            data: {
              accountId: payload.accountId,
              name: f.name ?? f.id,
              flowId: f.id,
              defaultBody: `Completa el formulario "${f.name ?? f.id}"`,
              defaultCta: "Iniciar",
              ...meta,
              createdByUserId,
            },
          });
    })
  );
  const upserted = remote.length;
  const flows = await db.waSavedFlow.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });
  return { fetched: remote.length, upserted, flows } as unknown as SyncFlowsResponse;
}

export async function archiveSavedFlow(id: number): Promise<void> {
  await db.waSavedFlow.update({ where: { id }, data: { archived: true } });
}

// ── Send via saved entity (chiquillas eligen, no editan) ─────────────────────
export async function sendSavedLocation(
  payload: SendSavedLocationPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const saved = await db.waSavedLocation.findUnique({ where: { id: payload.savedLocationId } });
  if (!saved || saved.archived) throw new DomainError("NOT_FOUND", "Ubicación no existe");
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  const apiResp = await sendLocationMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    latitude: saved.latitude,
    longitude: saved.longitude,
    name: saved.name,
    address: saved.address ?? undefined,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "LOCATION",
      status: "SENT",
      body: saved.name,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        location: {
          latitude: saved.latitude,
          longitude: saved.longitude,
          name: saved.name,
          address: saved.address,
        },
        saved_location_id: saved.id,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: `[ubicación] ${saved.name}` },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendSavedList(
  payload: SendSavedListPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const saved = await db.waSavedInteractiveList.findUnique({ where: { id: payload.savedListId } });
  if (!saved || saved.archived) throw new DomainError("NOT_FOUND", "Lista no existe");
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError("BAD_REQUEST", "Ventana 24h cerrada");
  }
  const sections = (saved.sections as unknown as ListSections) ?? [];
  const apiResp = await sendInteractiveListMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    bodyText: saved.bodyText,
    buttonText: saved.buttonText,
    sections,
    headerText: saved.headerText ?? undefined,
    footerText: saved.footerText ?? undefined,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: saved.bodyText,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        interactive_type: "list",
        button: saved.buttonText,
        sections,
        saved_list_id: saved.id,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: `[lista] ${saved.name}` },
  });
  // bump hit count
  await db.waSavedInteractiveList.update({
    where: { id: saved.id },
    data: { hitCount: { increment: 1 }, lastUsedAt: now },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendSavedFlow(
  payload: SendSavedFlowPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const saved = await db.waSavedFlow.findUnique({ where: { id: payload.savedFlowId } });
  if (!saved || saved.archived) throw new DomainError("NOT_FOUND", "Flow no existe");
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError("BAD_REQUEST", "Ventana 24h cerrada");
  }
  const apiResp = await sendFlowMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    flowId: saved.flowId,
    flowCta: payload.flowCta ?? saved.defaultCta,
    bodyText: payload.bodyText ?? saved.defaultBody,
    headerText: saved.defaultHeader ?? undefined,
    footerText: saved.defaultFooter ?? undefined,
    flowToken: saved.flowToken ?? undefined,
    initialScreen: saved.initialScreen ?? undefined,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: payload.bodyText ?? saved.defaultBody,
      sentByUserId,
      payload: {
        interactive_type: "flow",
        flow_id: saved.flowId,
        flow_cta: payload.flowCta ?? saved.defaultCta,
        saved_flow_id: saved.id,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: `[flow] ${saved.name}` },
  });
  await db.waSavedFlow.update({
    where: { id: saved.id },
    data: { hitCount: { increment: 1 }, lastUsedAt: now },
  });
  return { message } as unknown as SendMessageResponse;
}
