// Stickers guardados estilo WhatsApp, fuera de los handlers oRPC (golden 2026:
// handlers finos). El .webp durable vive en R2 (los media ids de Meta expiran
// ~30d); al reenviar se re-sube desde R2 para obtener un id fresco. sha256
// deduplica por cuenta. "Recientes" = orden por lastUsedAt; "Guardados" =
// favorite=true. Valida y lanza DomainError (mapeado a HTTP por
// orpc/error.ts::toORPCError).

import { createHash } from "node:crypto";
import { db } from "@finanzas/db";
import type {
  listSavedStickersInputSchema,
  savedStickerSchema,
  sendMessageResponseSchema,
  sendSavedStickerInputSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { logWarn } from "../lib/logger.ts";
import { getR2Object, putR2Object } from "../modules/cloudflare/r2.ts";
import { downloadMediaBytes, uploadMedia } from "../modules/wa-cloud/graph-client.ts";
import { sendMedia } from "./wa-messages.ts";

type SavedSticker = z.infer<typeof savedStickerSchema>;
type ListSavedStickersPayload = z.infer<typeof listSavedStickersInputSchema>;
type SendSavedStickerPayload = z.infer<typeof sendSavedStickerInputSchema>;
type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

const STICKER_MIME = "image/webp";

/** Ruta del proxy auth-gated que sirve el .webp (NUNCA URL pública de R2). */
export function savedStickerUrl(id: number): string {
  return `/api/wa-cloud/media/saved-sticker/${id}`;
}

function r2KeyFor(accountId: number, sha256: string): string {
  return `wa-stickers/${accountId}/${sha256}.webp`;
}

// Normaliza un hash a hex; Meta entrega sha256 en hex, pero si llegara en
// base64 (defensivo) lo reconvertimos. Si no hay hash usable, computamos uno.
function normalizeSha256(metaSha: string | undefined, bytes: Uint8Array): string {
  if (metaSha && /^[0-9a-f]{64}$/i.test(metaSha)) return metaSha.toLowerCase();
  return createHash("sha256").update(bytes).digest("hex");
}

function toSavedSticker(row: { id: number; favorite: boolean; lastUsedAt: Date | null; hitCount: number }): SavedSticker {
  return {
    id: row.id,
    url: savedStickerUrl(row.id),
    favorite: row.favorite,
    lastUsedAt: row.lastUsedAt,
    hitCount: row.hitCount,
  };
}

// Extrae el media id de Meta de un WaMessage tipo STICKER (payload.sticker.id).
function stickerMediaIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const sticker = (payload as Record<string, unknown>).sticker;
  if (!sticker || typeof sticker !== "object") return null;
  const id = (sticker as Record<string, unknown>).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

// ── Persistencia compartida: baja bytes de Meta, hashea, guarda en R2 y
//    upsertea la fila (idempotente por accountId+sha256). ────────────────────
async function persistSticker(opts: {
  accountId: number;
  mediaId: string;
  favorite: boolean;
  addedByUserId?: number | null;
  bumpUse?: boolean;
}): Promise<{ id: number; favorite: boolean; lastUsedAt: Date | null; hitCount: number }> {
  const { bytes, mimeType, sha256: metaSha } = await downloadMediaBytes(opts.mediaId, opts.accountId);
  const sha256 = normalizeSha256(metaSha, bytes);
  const r2Key = r2KeyFor(opts.accountId, sha256);

  const existing = await db.waSavedSticker.findUnique({
    where: { accountId_sha256: { accountId: opts.accountId, sha256 } },
  });

  // Solo subimos a R2 si la fila no existe (el blob es content-addressed por
  // sha256, así que re-subir sería idempotente pero innecesario).
  if (!existing) {
    await putR2Object(r2Key, bytes, mimeType || STICKER_MIME);
  }

  const now = new Date();
  if (existing) {
    const row = await db.waSavedSticker.update({
      where: { id: existing.id },
      data: {
        // Favorito es "sticky": una vez marcado guardado, no lo desmarca un
        // envío ad-hoc. Solo lo sube a true.
        favorite: opts.favorite ? true : existing.favorite,
        ...(opts.bumpUse ? { hitCount: { increment: 1 }, lastUsedAt: now } : {}),
      },
    });
    return row;
  }

  const row = await db.waSavedSticker.create({
    data: {
      accountId: opts.accountId,
      r2Key,
      mimeType: mimeType || STICKER_MIME,
      sha256,
      favorite: opts.favorite,
      addedByUserId: opts.addedByUserId ?? null,
      ...(opts.bumpUse ? { hitCount: 1, lastUsedAt: now } : {}),
    },
  });
  return row;
}

// ── Listado por pestaña ──────────────────────────────────────────────────────
export async function listSavedStickers(
  payload: ListSavedStickersPayload
): Promise<{ stickers: SavedSticker[] }> {
  const where =
    payload.tab === "guardados"
      ? { accountId: payload.accountId, favorite: true }
      : { accountId: payload.accountId };
  // "recientes" y "guardados" ordenan por uso reciente; createdAt como
  // desempate. Postgres pone NULLS LAST por defecto en ORDER BY DESC… no: en
  // ASC NULLS LAST, en DESC NULLS FIRST. ZenStack/Kysely soporta `nulls`.
  const rows = await db.waSavedSticker.findMany({
    where,
    orderBy: [{ lastUsedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return { stickers: rows.map((r: (typeof rows)[number]) => toSavedSticker(r)) };
}

// ── Marcar un sticker recibido (inbound) → "Guardados" ───────────────────────
export async function saveStickerFromMessage(
  payload: { messageId: number },
  addedByUserId: number
): Promise<SavedSticker> {
  const message = await db.waMessage.findUnique({
    where: { id: payload.messageId },
    select: {
      id: true,
      type: true,
      payload: true,
      phoneNumber: { select: { accountId: true } },
    },
  });
  if (!message) throw new DomainError("NOT_FOUND", "Mensaje no encontrado");
  if (message.type !== "STICKER") {
    throw new DomainError("BAD_REQUEST", "El mensaje no es un sticker");
  }
  const mediaId = stickerMediaIdFromPayload(message.payload);
  if (!mediaId) throw new DomainError("NOT_FOUND", "El sticker no tiene media id");

  const row = await persistSticker({
    accountId: message.phoneNumber.accountId,
    mediaId,
    favorite: true,
    addedByUserId,
  });
  return toSavedSticker(row);
}

// ── Quitar de "Guardados" (toggle favorite=false; permanece en recientes) ────
export async function unsaveSticker(id: number): Promise<void> {
  const existing = await db.waSavedSticker.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new DomainError("NOT_FOUND", "Sticker no encontrado");
  await db.waSavedSticker.update({ where: { id }, data: { favorite: false } });
}

// ── Bump de "recientes" tras un envío exitoso desde el picker ────────────────
export async function recordStickerSent(savedStickerId: number): Promise<void> {
  await db.waSavedSticker.update({
    where: { id: savedStickerId },
    data: { hitCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}

// ── Re-subir el .webp desde R2 a Meta → media id fresco (expira ~30d) ─────────
export async function reuploadStickerToMeta(
  savedStickerId: number,
  phoneNumberId: number
): Promise<string> {
  const saved = await db.waSavedSticker.findUnique({ where: { id: savedStickerId } });
  if (!saved) throw new DomainError("NOT_FOUND", "Sticker no encontrado");
  const obj = await getR2Object(saved.r2Key);
  // Acumula el stream a un Blob para el upload multipart de Meta.
  const chunks: Uint8Array[] = [];
  const reader = obj.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const blob = new Blob(chunks as BlobPart[], { type: saved.mimeType || STICKER_MIME });
  const { id } = await uploadMedia(
    phoneNumberId,
    blob,
    saved.mimeType || STICKER_MIME,
    `sticker-${saved.id}.webp`
  );
  return id;
}

// ── Best-effort: refrescar "recientes" tras un envío ad-hoc de .webp ─────────
// Llamado desde sendMedia(type:"sticker"). NUNCA debe romper el envío: el
// caller lo envuelve en try/catch, pero igual lo blindamos acá.
export async function recordAdHocStickerSent(opts: {
  accountId: number;
  mediaId: string;
  addedByUserId?: number | null;
}): Promise<void> {
  try {
    await persistSticker({
      accountId: opts.accountId,
      mediaId: opts.mediaId,
      favorite: false,
      addedByUserId: opts.addedByUserId ?? null,
      bumpUse: true,
    });
  } catch (err) {
    logWarn("[wa-stickers] recordAdHocStickerSent failed (ignorado)", {
      accountId: opts.accountId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ── Enviar un sticker guardado desde el picker ───────────────────────────────
// Re-sube el .webp desde R2 (id fresco), envía vía el path sendMedia(sticker) y
// bumpea "recientes". Devuelve el WaMessage creado (espeja sendMedia).
export async function sendSavedSticker(
  payload: SendSavedStickerPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const saved = await db.waSavedSticker.findUnique({
    where: { id: payload.savedStickerId },
    select: { id: true },
  });
  if (!saved) throw new DomainError("NOT_FOUND", "Sticker no encontrado");

  const freshMediaId = await reuploadStickerToMeta(payload.savedStickerId, payload.phoneNumberId);
  const result = await sendMedia(
    {
      conversationId: payload.conversationId,
      phoneNumberId: payload.phoneNumberId,
      type: "sticker",
      mediaId: freshMediaId,
      contextMetaMessageId: payload.contextMetaMessageId,
    },
    sentByUserId
  );
  await recordStickerSent(payload.savedStickerId);
  return result;
}
