import { db } from "@finanzas/db";
import { logError, logEvent } from "../../lib/logger.ts";
import { normalizeToE164 } from "./phone.ts";

const BAILEYS_TYPE_MAP: Record<string, string> = {
  conversation: "TEXT",
  extendedTextMessage: "TEXT",
  imageMessage: "IMAGE",
  videoMessage: "VIDEO",
  audioMessage: "AUDIO",
  documentMessage: "DOCUMENT",
  stickerMessage: "STICKER",
  locationMessage: "LOCATION",
  liveLocationMessage: "LOCATION",
  contactMessage: "CONTACTS",
  contactsArrayMessage: "CONTACTS",
  reactionMessage: "REACTION",
  templateMessage: "TEMPLATE",
  templateButtonReplyMessage: "BUTTON",
  buttonsResponseMessage: "BUTTON",
  listResponseMessage: "INTERACTIVE",
  interactiveMessage: "INTERACTIVE",
  pollCreationMessage: "UNSUPPORTED",
  pollUpdateMessage: "UNSUPPORTED",
  protocolMessage: "SYSTEM",
};

function jidToE164(jid: string): string | null {
  if (!jid) return null;
  // Skip groups and broadcasts.
  if (jid.endsWith("@g.us") || jid.endsWith("@broadcast") || jid === "status@broadcast") return null;
  const local = jid.split("@")[0];
  if (!local) return null;
  // Strip device suffix: "5691234:23"
  const phone = local.split(":")[0];
  if (!phone) return null;
  try {
    return normalizeToE164(phone);
  } catch {
    return null;
  }
}

function mapBaileysStatus(s: string): "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" {
  switch (s) {
    case "READ":
    case "PLAYED":
      return "READ";
    case "DELIVERY_ACK":
    case "DELIVERED":
      return "DELIVERED";
    case "SERVER_ACK":
    case "SENT":
      return "SENT";
    case "ERROR":
      return "FAILED";
    default:
      return "PENDING";
  }
}

function mapBaileysType(t: string): string {
  return BAILEYS_TYPE_MAP[t] ?? "UNSUPPORTED";
}

export type MigrationResult = {
  dryRun: boolean;
  contactsImported: number;
  contactsSkipped: number;
  conversationsImported: number;
  conversationsSkipped: number;
  messagesImported: number;
  messagesSkipped: number;
  errors: string[];
};

export async function migrateBaileysToWaCloud(
  phoneNumberRowId: number,
  dryRun: boolean,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    dryRun,
    contactsImported: 0,
    contactsSkipped: 0,
    conversationsImported: 0,
    conversationsSkipped: 0,
    messagesImported: 0,
    messagesSkipped: 0,
    errors: [],
  };

  const phone = await db.waPhoneNumber.findUnique({ where: { id: phoneNumberRowId } });
  if (!phone) {
    result.errors.push(`WaPhoneNumber ${phoneNumberRowId} no existe`);
    return result;
  }

  // ── Contacts ────────────────────────────────────────────────────────────────
  const baileysContacts = await db.whatsappContact.findMany({});
  const e164ToContactId = new Map<string, number>();

  for (const bc of baileysContacts) {
    const e164 = jidToE164(bc.jid);
    if (!e164) {
      result.contactsSkipped++;
      continue;
    }
    if (e164ToContactId.has(e164)) {
      result.contactsSkipped++;
      continue;
    }
    const existing = await db.waContact.findUnique({ where: { phoneE164: e164 } });
    if (existing) {
      e164ToContactId.set(e164, existing.id);
      // Refresh pushName if Baileys has a better one.
      if (!existing.pushName && (bc.notify || bc.name)) {
        if (!dryRun) {
          await db.waContact.update({
            where: { id: existing.id },
            data: { pushName: bc.notify ?? bc.name },
          });
        }
      }
      result.contactsSkipped++;
      continue;
    }
    if (dryRun) {
      result.contactsImported++;
      continue;
    }
    try {
      const created = await db.waContact.create({
        data: {
          phoneE164: e164,
          pushName: bc.notify ?? null,
          name: bc.name ?? bc.verifiedName ?? bc.notify ?? null,
        },
      });
      e164ToContactId.set(e164, created.id);
      result.contactsImported++;
    } catch (err) {
      result.errors.push(`contact ${e164}: ${String(err)}`);
    }
  }

  // ── Conversations ──────────────────────────────────────────────────────────
  const baileysChats = await db.whatsappChat.findMany({
    where: { isGroup: { not: true } },
  });

  const jidToConvId = new Map<string, number>();
  const convIdToContactId = new Map<number, number>();

  for (const ch of baileysChats) {
    const e164 = jidToE164(ch.jid);
    if (!e164) {
      result.conversationsSkipped++;
      continue;
    }
    let contactId = e164ToContactId.get(e164);
    if (!contactId) {
      // Maybe contact existed before our scan loop.
      const fallback = await db.waContact.findUnique({ where: { phoneE164: e164 } });
      if (!fallback) {
        if (dryRun) {
          // Will be created live, count synthetic.
          result.contactsImported++;
        } else {
          const created = await db.waContact.create({
            data: { phoneE164: e164, name: ch.name ?? null },
          });
          contactId = created.id;
          e164ToContactId.set(e164, created.id);
          result.contactsImported++;
        }
      } else {
        contactId = fallback.id;
        e164ToContactId.set(e164, fallback.id);
      }
    }
    if (!contactId) {
      result.conversationsSkipped++;
      continue;
    }
    let conv = await db.waConversation.findUnique({ where: { contactId } });
    if (!conv && !dryRun) {
      try {
        conv = await db.waConversation.create({
          data: {
            contactId,
            lastMessageAt: ch.conversationTimestamp ?? null,
            lastMessagePreview: ch.lastMessagePreview ?? null,
            unreadCount: ch.unreadCount ?? 0,
            status:
              ch.archived === true
                ? "ARCHIVED"
                : ch.unreadCount && ch.unreadCount > 0
                  ? "PENDING"
                  : "OPEN",
          },
        });
      } catch (err) {
        result.errors.push(`conv ${e164}: ${String(err)}`);
        continue;
      }
    }
    if (!conv) {
      result.conversationsImported++;
      continue;
    }
    // Ensure channel link to selected phone number.
    const channel = await db.waConversationChannel.findUnique({
      where: {
        conversationId_phoneNumberId: {
          conversationId: conv.id,
          phoneNumberId: phoneNumberRowId,
        },
      },
    });
    if (!channel && !dryRun) {
      await db.waConversationChannel.create({
        data: { conversationId: conv.id, phoneNumberId: phoneNumberRowId },
      });
    }
    jidToConvId.set(ch.jid, conv.id);
    convIdToContactId.set(conv.id, contactId);
    if (channel) result.conversationsSkipped++;
    else result.conversationsImported++;
  }

  // ── Messages (paged) ───────────────────────────────────────────────────────
  const PAGE = 500;
  let cursor: { remoteJid: string; messageId: string; participantJidKey: string } | undefined;
  let total = 0;

  while (true) {
    const batch = await db.whatsappMessage.findMany({
      take: PAGE,
      ...(cursor
        ? {
            skip: 1,
            cursor: { remoteJid_messageId_participantJidKey: cursor },
          }
        : {}),
      orderBy: [
        { remoteJid: "asc" as const },
        { messageId: "asc" as const },
        { participantJidKey: "asc" as const },
      ],
    });
    if (batch.length === 0) break;
    cursor = {
      remoteJid: batch[batch.length - 1]!.remoteJid,
      messageId: batch[batch.length - 1]!.messageId,
      participantJidKey: batch[batch.length - 1]!.participantJidKey,
    };
    total += batch.length;

    for (const m of batch) {
      const convId = jidToConvId.get(m.remoteJid);
      const contactId = convId ? convIdToContactId.get(convId) : undefined;
      if (!convId || !contactId) {
        result.messagesSkipped++;
        continue;
      }
      // Build a stable composite metaMessageId so re-runs are idempotent.
      const metaId = `baileys:${m.remoteJid}:${m.messageId}:${m.participantJidKey}`;
      const existing = await db.waMessage.findFirst({
        where: { metaMessageId: metaId },
        select: { id: true },
      });
      if (existing) {
        result.messagesSkipped++;
        continue;
      }
      const ts =
        m.messageTimestamp ?? m.sentAt ?? m.createdAt ?? new Date();
      const direction = m.fromMe ? "OUTBOUND" : "INBOUND";
      const type = mapBaileysType(m.messageType);
      const status = m.fromMe ? mapBaileysStatus(m.status) : "DELIVERED";

      if (dryRun) {
        result.messagesImported++;
        continue;
      }
      try {
        await db.waMessage.create({
          data: {
            conversationId: convId,
            contactId,
            phoneNumberId: phoneNumberRowId,
            metaMessageId: metaId,
            direction,
            status,
            type: type as
              | "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "STICKER"
              | "LOCATION" | "CONTACTS" | "INTERACTIVE" | "BUTTON" | "TEMPLATE"
              | "REACTION" | "SYSTEM" | "UNSUPPORTED",
            body: m.textPreview ?? null,
            timestamp: ts,
            payload: (m.rawMessageJson ?? m.rawContentJson ?? null) as never,
          },
        });
        result.messagesImported++;
      } catch (err) {
        result.errors.push(`msg ${metaId}: ${String(err).slice(0, 100)}`);
      }
    }
  }

  logEvent("[wa-cloud.baileys-migration] complete", { ...result, totalScanned: total });
  if (result.errors.length > 0) {
    logError("[wa-cloud.baileys-migration] errors", { errors: result.errors.slice(0, 10) });
  }
  return result;
}
