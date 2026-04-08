import { kysely, type SchemaType } from "@finanzas/db";
import type { Kysely } from "kysely";
import type {
  GroupMetadata,
  GroupParticipant,
  MessageUserReceiptUpdate,
  WAMessageKey,
} from "baileys";

type WhatsappChatRow = {
  archived: boolean | null;
  conversation_timestamp: Date | string | null;
  created_at: Date | string;
  ephemeral_expiration: number | null;
  id: string;
  is_blocked: boolean | null;
  is_group: boolean | null;
  jid: string;
  last_message_id: string | null;
  last_message_preview: string | null;
  mute_end_time: Date | string | null;
  name: string | null;
  not_spam: boolean | null;
  pinned: boolean | null;
  profile_picture_url: string | null;
  raw_chat_json: null | Record<string, unknown>;
  unread_count: number | null;
  updated_at: Date | string;
};

type WhatsappMessageRow = {
  created_at: Date | string;
  deleted_for_everyone: boolean;
  deleted_for_me: boolean;
  direction: "INBOUND" | "OUTBOUND";
  from_me: boolean;
  has_media: boolean;
  media_missing: boolean;
  message_id: string;
  message_type: string;
  message_timestamp: Date | string | null;
  participant_jid: string | null;
  phone: string | null;
  played_at: Date | string | null;
  raw_content_json: null | Record<string, unknown>;
  read_at: Date | string | null;
  remote_jid: string;
  sent_at: Date | string | null;
  starred: boolean;
  status: string;
  text_preview: string | null;
  updated_at: Date | string;
  wa_id: string | null;
};

type WhatsappMessageReactionRow = {
  actor_jid: string;
  created_at: Date | string;
  emoji: string;
  message_id: string;
  remote_jid: string;
  removed: boolean;
  updated_at: Date | string;
};

type WhatsappMessageReceiptRow = {
  created_at: Date | string;
  delivered_devices: null | string[];
  message_id: string;
  pending_devices: null | string[];
  played_at: Date | string | null;
  read_at: Date | string | null;
  receipt_at: Date | string | null;
  receipt_type: string;
  recipient_jid: string;
  remote_jid: string;
  updated_at: Date | string;
};

type WhatsappPresenceStateRow = {
  chat_jid: string;
  created_at: Date | string;
  last_known_presence: string;
  last_seen: Date | string | null;
  participant_jid: string;
  updated_at: Date | string;
};

type WhatsappGroupRow = {
  creation: Date | string | null;
  created_at: Date | string;
  desc: string | null;
  ephemeral_duration: number | null;
  jid: string;
  owner: string | null;
  raw_group_json: null | Record<string, unknown>;
  size: number | null;
  subject: string;
  updated_at: Date | string;
};

type WhatsappGroupParticipantRow = {
  admin: string | null;
  created_at: Date | string;
  group_jid: string;
  is_super_admin: boolean | null;
  participant_jid: string;
  updated_at: Date | string;
};

type WhatsappBlockedJidRow = {
  created_at: Date | string;
  jid: string;
  updated_at: Date | string;
};

type WhatsappContactRow = {
  img_url: string | null;
  jid: string;
  name: string | null;
  notify: string | null;
  verified_name: string | null;
};

type ChatStateDb = SchemaType & {
  whatsapp_blocked_jids: WhatsappBlockedJidRow;
  whatsapp_chats: WhatsappChatRow;
  whatsapp_contacts: WhatsappContactRow;
  whatsapp_group_participants: WhatsappGroupParticipantRow;
  whatsapp_groups: WhatsappGroupRow;
  whatsapp_message_reactions: WhatsappMessageReactionRow;
  whatsapp_message_receipts: WhatsappMessageReceiptRow;
  whatsapp_messages: WhatsappMessageRow;
  whatsapp_presence_states: WhatsappPresenceStateRow;
};

const chatStateDb = kysely as unknown as Kysely<ChatStateDb>;

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function timestampToDate(
  value: null | number | string | { toString: () => string } | undefined,
) {
  if (value == null) return null;
  const raw =
    typeof value === "number" || typeof value === "string" ? Number(value) : Number(value.toString());
  return Number.isFinite(raw) ? new Date(raw * 1000) : null;
}

function timestampMsToDate(
  value: null | number | string | { toString: () => string } | undefined,
) {
  if (value == null) return null;
  const raw =
    typeof value === "number" || typeof value === "string" ? Number(value) : Number(value.toString());
  return Number.isFinite(raw) ? new Date(raw) : null;
}

function getQuotedMessageId(content: null | Record<string, unknown> | undefined) {
  if (!content) return null;
  const contextCarrier = [
    (content.extendedTextMessage as { contextInfo?: { stanzaId?: string } } | undefined)?.contextInfo,
    (content.imageMessage as { contextInfo?: { stanzaId?: string } } | undefined)?.contextInfo,
    (content.videoMessage as { contextInfo?: { stanzaId?: string } } | undefined)?.contextInfo,
    (content.documentMessage as { contextInfo?: { stanzaId?: string } } | undefined)?.contextInfo,
  ].find(Boolean);
  return contextCarrier?.stanzaId ?? null;
}

function typingFromPresence(value: string, updatedAt: Date | string) {
  const date = asDate(updatedAt);
  if (!date) return false;
  return ["composing", "recording", "paused"].includes(value) && Date.now() - date.getTime() < 30_000;
}

export type ChatSidebarItemRecord = {
  avatarUrl: string | null;
  isArchived: boolean;
  isBlocked: boolean;
  isGroup: boolean;
  isMuted: boolean;
  jid: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  name: string | null;
  presence: string | null;
  typing: boolean;
  unreadCount: number;
};

export type ChatMessageReactionRecord = {
  actorJid: string;
  emoji: string;
  messageId: string;
  removed: boolean;
  updatedAt: Date;
};

export type ChatMessageReceiptRecord = {
  deliveredDevices: string[];
  messageId: string;
  playedAt: Date | null;
  readAt: Date | null;
  receiptAt: Date | null;
  receiptType: string;
  recipientJid: string;
  updatedAt: Date;
};

export type ChatThreadMessageRecord = {
  createdAt: Date | null;
  deletedForEveryone: boolean;
  deletedForMe: boolean;
  direction: "inbound" | "outbound";
  fromMe: boolean;
  hasMedia: boolean;
  mediaMissing: boolean;
  messageId: string;
  messageType: string;
  messageTimestamp: Date | null;
  participantJid: string | null;
  phone: string | null;
  quotedMessageId: string | null;
  quotedPreview: string | null;
  reactions: ChatMessageReactionRecord[];
  receipts: ChatMessageReceiptRecord[];
  remoteJid: string;
  starred: boolean;
  status: string;
  textPreview: string | null;
  updatedAt: Date | null;
  waId: string | null;
};

export type ChatMetaRecord = {
  avatarUrl: string | null;
  disappearingDuration: number | null;
  groupMeta: null | {
    desc: string | null;
    owner: string | null;
    participants: Array<{
      admin: string | null;
      isSuperAdmin: boolean | null;
      participantJid: string;
    }>;
    size: number | null;
    subject: string;
  };
  isBlocked: boolean;
  jid: string;
  name: string | null;
  statusText: string | null;
};

export type PresenceStateRecord = {
  chatJid: string;
  lastKnownPresence: string;
  lastSeen: Date | null;
  participantJid: string;
  updatedAt: Date | null;
};

export async function upsertWhatsappMessageReactionEvents(
  events: Array<{
    key: WAMessageKey;
    reaction: {
      key?: WAMessageKey | null;
      senderTimestampMs?: number | string | { toString: () => string } | null;
      text?: string | null;
    };
  }>,
) {
  const now = new Date();
  await Promise.all(
    events
      .filter((event) => event.key.remoteJid && event.key.id)
      .map(async (event) => {
        const remoteJid = event.key.remoteJid!;
        const messageId = event.key.id!;
        const actorJid =
          event.reaction.key?.participant ?? event.reaction.key?.remoteJid ?? event.key.participant ?? remoteJid;
        const emoji = event.reaction.text ?? "";

        if (!emoji) {
          await chatStateDb
            .updateTable("whatsapp_message_reactions")
            .set({
              removed: true,
              updated_at: timestampMsToDate(event.reaction.senderTimestampMs) ?? now,
            })
            .where("remote_jid", "=", remoteJid)
            .where("message_id", "=", messageId)
            .where("actor_jid", "=", actorJid)
            .execute();
          return;
        }

        await chatStateDb
          .insertInto("whatsapp_message_reactions")
          .values({
            actor_jid: actorJid,
            created_at: now,
            emoji,
            message_id: messageId,
            remote_jid: remoteJid,
            removed: false,
            updated_at: timestampMsToDate(event.reaction.senderTimestampMs) ?? now,
          })
          .onConflict((oc) =>
            oc.columns(["remote_jid", "message_id", "actor_jid", "emoji"]).doUpdateSet({
              removed: false,
              updated_at: timestampMsToDate(event.reaction.senderTimestampMs) ?? now,
            }),
          )
          .execute();
      }),
  );
}

export async function applyWhatsappMessagesDelete(deleteEvent: {
  all?: true;
  jid?: string;
  keys?: WAMessageKey[];
}) {
  const now = new Date();

  if (deleteEvent.all && deleteEvent.jid) {
    await chatStateDb
      .updateTable("whatsapp_messages")
      .set({
        deleted_for_me: true,
        updated_at: now,
      })
      .where("remote_jid", "=", deleteEvent.jid)
      .execute();
    return;
  }

  await Promise.all(
    (deleteEvent.keys ?? [])
      .filter((key) => key.remoteJid && key.id)
      .map((key) =>
        chatStateDb
          .updateTable("whatsapp_messages")
          .set({
            deleted_for_everyone: Boolean(key.fromMe),
            deleted_for_me: true,
            updated_at: now,
          })
          .where("remote_jid", "=", key.remoteJid!)
          .where("message_id", "=", key.id!)
          .execute(),
      ),
  );
}

export async function upsertWhatsappMessageReceiptUpdates(updates: MessageUserReceiptUpdate[]) {
  const now = new Date();
  await Promise.all(
    updates
      .filter((update) => update.key.remoteJid && update.key.id && update.receipt.userJid)
      .map(async (update) => {
        const receiptAt = timestampToDate(update.receipt.receiptTimestamp);
        const readAt = timestampToDate(update.receipt.readTimestamp);
        const playedAt = timestampToDate(update.receipt.playedTimestamp);
        const receiptType = playedAt
          ? "played"
          : readAt
            ? "read"
            : receiptAt
              ? "delivered"
              : "sent";

        await chatStateDb
          .insertInto("whatsapp_message_receipts")
          .values({
            created_at: now,
            delivered_devices: update.receipt.deliveredDeviceJid ?? [],
            message_id: update.key.id!,
            pending_devices: update.receipt.pendingDeviceJid ?? [],
            played_at: playedAt,
            read_at: readAt,
            receipt_at: receiptAt,
            receipt_type: receiptType,
            recipient_jid: update.receipt.userJid!,
            remote_jid: update.key.remoteJid!,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc
              .columns(["remote_jid", "message_id", "recipient_jid", "receipt_type"])
              .doUpdateSet({
                delivered_devices: update.receipt.deliveredDeviceJid ?? [],
                pending_devices: update.receipt.pendingDeviceJid ?? [],
                played_at: playedAt,
                read_at: readAt,
                receipt_at: receiptAt,
                updated_at: now,
              }),
          )
          .execute();
      }),
  );
}

export async function upsertWhatsappPresenceUpdate(update: {
  id: string;
  presences: Record<string, { lastKnownPresence: string; lastSeen?: number }>;
}) {
  const now = new Date();
  await Promise.all(
    Object.entries(update.presences).map(([participantJid, presence]) =>
      chatStateDb
        .insertInto("whatsapp_presence_states")
        .values({
          chat_jid: update.id,
          created_at: now,
          last_known_presence: presence.lastKnownPresence,
          last_seen: presence.lastSeen ? new Date(presence.lastSeen * 1000) : null,
          participant_jid: participantJid,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.columns(["chat_jid", "participant_jid"]).doUpdateSet({
            last_known_presence: presence.lastKnownPresence,
            last_seen: presence.lastSeen ? new Date(presence.lastSeen * 1000) : null,
            updated_at: now,
          }),
        )
        .execute(),
    ),
  );
}

export async function upsertWhatsappGroups(groups: GroupMetadata[]) {
  const now = new Date();
  await Promise.all(
    groups.map(async (group) => {
      await chatStateDb
        .insertInto("whatsapp_groups")
        .values({
          created_at: now,
          creation: group.creation ? new Date(Number(group.creation) * 1000) : null,
          desc: group.desc ?? null,
          ephemeral_duration: group.ephemeralDuration ?? null,
          jid: group.id,
          owner: group.owner ?? null,
          raw_group_json: group as unknown as Record<string, unknown>,
          size: group.size ?? group.participants.length,
          subject: group.subject,
          updated_at: now,
        })
        .onConflict((oc) =>
          oc.column("jid").doUpdateSet({
            creation: group.creation ? new Date(Number(group.creation) * 1000) : null,
            desc: group.desc ?? null,
            ephemeral_duration: group.ephemeralDuration ?? null,
            owner: group.owner ?? null,
            raw_group_json: group as unknown as Record<string, unknown>,
            size: group.size ?? group.participants.length,
            subject: group.subject,
            updated_at: now,
          }),
        )
        .execute();

      await upsertWhatsappGroupParticipants(group.id, group.participants);

      await chatStateDb
        .updateTable("whatsapp_chats")
        .set({
          is_group: true,
          updated_at: now,
        })
        .where("jid", "=", group.id)
        .execute();
    }),
  );
}

export async function upsertWhatsappGroupParticipants(
  groupJid: string,
  participants: GroupParticipant[],
) {
  const now = new Date();
  await Promise.all(
    participants
      .filter((participant) => Boolean(participant.id))
      .map((participant) =>
        chatStateDb
          .insertInto("whatsapp_group_participants")
          .values({
            admin: participant.admin ?? null,
            created_at: now,
            group_jid: groupJid,
            is_super_admin: participant.isSuperAdmin ?? null,
            participant_jid: participant.id,
            updated_at: now,
          })
          .onConflict((oc) =>
            oc.columns(["group_jid", "participant_jid"]).doUpdateSet({
              admin: participant.admin ?? null,
              is_super_admin: participant.isSuperAdmin ?? null,
              updated_at: now,
            }),
          )
          .execute(),
      ),
  );
}

export async function applyWhatsappGroupParticipantsUpdate(args: {
  action: "add" | "demote" | "modify" | "promote" | "remove";
  id: string;
  participants: GroupParticipant[];
}) {
  if (args.action === "remove") {
    await Promise.all(
      args.participants
        .filter((participant) => Boolean(participant.id))
        .map((participant) =>
          chatStateDb
            .deleteFrom("whatsapp_group_participants")
            .where("group_jid", "=", args.id)
            .where("participant_jid", "=", participant.id!)
            .execute(),
        ),
    );
    return;
  }

  await upsertWhatsappGroupParticipants(args.id, args.participants);
}

export async function replaceWhatsappBlockedJids(blocklist: string[]) {
  const now = new Date();
  await chatStateDb.deleteFrom("whatsapp_blocked_jids").execute();
  if (blocklist.length > 0) {
    await chatStateDb
      .insertInto("whatsapp_blocked_jids")
      .values(
        blocklist.map((jid) => ({
          created_at: now,
          jid,
          updated_at: now,
        })),
      )
      .execute();
  }

  await chatStateDb.updateTable("whatsapp_chats").set({ is_blocked: false }).execute();
  if (blocklist.length > 0) {
    await chatStateDb
      .updateTable("whatsapp_chats")
      .set({ is_blocked: true })
      .where("jid", "in", blocklist)
      .execute();
  }
}

export async function applyWhatsappBlockedJidsUpdate(args: {
  blocklist: string[];
  type: "add" | "remove";
}) {
  const now = new Date();
  if (args.type === "add") {
    await Promise.all(
      args.blocklist.map((jid) =>
        chatStateDb
          .insertInto("whatsapp_blocked_jids")
          .values({
            created_at: now,
            jid,
            updated_at: now,
          })
          .onConflict((oc) => oc.column("jid").doUpdateSet({ updated_at: now }))
          .execute(),
      ),
    );
    await chatStateDb
      .updateTable("whatsapp_chats")
      .set({ is_blocked: true, updated_at: now })
      .where("jid", "in", args.blocklist)
      .execute();
    return;
  }

  await chatStateDb.deleteFrom("whatsapp_blocked_jids").where("jid", "in", args.blocklist).execute();
  await chatStateDb
    .updateTable("whatsapp_chats")
    .set({ is_blocked: false, updated_at: now })
    .where("jid", "in", args.blocklist)
    .execute();
}

export async function deleteWhatsappChatRows(jids: string[]) {
  if (jids.length === 0) return;
  await chatStateDb.deleteFrom("whatsapp_chats").where("jid", "in", jids).execute();
}

export async function updateWhatsappChatDecorations(args: {
  jid: string;
  ephemeralExpiration?: number | null;
  isBlocked?: boolean | null;
  lastMessagePreview?: string | null;
  profilePictureUrl?: string | null;
}) {
  const patch: Partial<WhatsappChatRow> = {
    updated_at: new Date(),
  };
  if (args.ephemeralExpiration !== undefined) patch.ephemeral_expiration = args.ephemeralExpiration;
  if (args.isBlocked !== undefined) patch.is_blocked = args.isBlocked;
  if (args.lastMessagePreview !== undefined) patch.last_message_preview = args.lastMessagePreview;
  if (args.profilePictureUrl !== undefined) patch.profile_picture_url = args.profilePictureUrl;

  await chatStateDb.updateTable("whatsapp_chats").set(patch).where("jid", "=", args.jid).execute();
}

export async function listChatSidebar(args?: {
  filter?: "all" | "archived" | "blocked" | "groups" | "unread";
  limit?: number;
  search?: string;
}) {
  const limit = args?.limit ?? 50;
  let query = chatStateDb
    .selectFrom("whatsapp_chats as c")
    .leftJoin("whatsapp_contacts as ct", "ct.jid", "c.jid")
    .select([
      "c.archived as archived",
      "c.conversation_timestamp as conversationTimestamp",
      "c.is_blocked as isBlocked",
      "c.is_group as isGroup",
      "c.jid as jid",
      "c.last_message_preview as lastMessagePreview",
      "c.mute_end_time as muteEndTime",
      "c.name as chatName",
      "c.profile_picture_url as profilePictureUrl",
      "c.unread_count as unreadCount",
      "ct.name as contactName",
      "ct.notify as contactNotify",
      "ct.verified_name as verifiedName",
      "ct.img_url as contactImgUrl",
    ])
    .orderBy("c.conversation_timestamp", "desc")
    .limit(limit);

  if (args?.filter === "archived") query = query.where("c.archived", "=", true);
  if (args?.filter === "blocked") query = query.where("c.is_blocked", "=", true);
  if (args?.filter === "groups") query = query.where("c.is_group", "=", true);
  if (args?.filter === "unread") query = query.where("c.unread_count", ">", 0);
  if (args?.search) {
    query = query.where((eb) =>
      eb.or([
        eb("c.name", "ilike", `%${args.search}%`),
        eb("ct.name", "ilike", `%${args.search}%`),
        eb("ct.notify", "ilike", `%${args.search}%`),
        eb("c.jid", "ilike", `%${args.search}%`),
      ]),
    );
  }

  const chats = await query.execute();
  const presenceRows = await chatStateDb
    .selectFrom("whatsapp_presence_states")
    .selectAll()
    .orderBy("updated_at", "desc")
    .execute();
  const latestPresence = new Map<string, WhatsappPresenceStateRow>();
  for (const row of presenceRows) {
    if (!latestPresence.has(row.chat_jid)) latestPresence.set(row.chat_jid, row);
  }

  return chats.map((chat) => {
    const presence = latestPresence.get(chat.jid);
    return {
      avatarUrl: chat.profilePictureUrl ?? chat.contactImgUrl ?? null,
      isArchived: Boolean(chat.archived),
      isBlocked: Boolean(chat.isBlocked),
      isGroup: Boolean(chat.isGroup),
      isMuted: Boolean(chat.muteEndTime && asDate(chat.muteEndTime) && asDate(chat.muteEndTime)!.getTime() > Date.now()),
      jid: chat.jid,
      lastMessageAt: asDate(chat.conversationTimestamp),
      lastMessagePreview: chat.lastMessagePreview,
      name: chat.chatName ?? chat.contactName ?? chat.contactNotify ?? chat.verifiedName ?? chat.jid,
      presence: presence?.last_known_presence ?? null,
      typing: presence ? typingFromPresence(presence.last_known_presence, presence.updated_at) : false,
      unreadCount: chat.unreadCount ?? 0,
    } satisfies ChatSidebarItemRecord;
  });
}

export async function listMessageReactions(args: { jid: string; messageIds?: string[] }) {
  let query = chatStateDb
    .selectFrom("whatsapp_message_reactions")
    .selectAll()
    .where("remote_jid", "=", args.jid)
    .orderBy("updated_at", "desc");
  if (args.messageIds?.length) {
    query = query.where("message_id", "in", args.messageIds);
  }
  const rows = await query.execute();
  return rows.map((row) => ({
    actorJid: row.actor_jid,
    emoji: row.emoji,
    messageId: row.message_id,
    removed: row.removed,
    updatedAt: asDate(row.updated_at) ?? new Date(),
  }));
}

export async function listMessageReceipts(args: { jid: string; messageIds?: string[] }) {
  let query = chatStateDb
    .selectFrom("whatsapp_message_receipts")
    .selectAll()
    .where("remote_jid", "=", args.jid)
    .orderBy("updated_at", "desc");
  if (args.messageIds?.length) {
    query = query.where("message_id", "in", args.messageIds);
  }
  const rows = await query.execute();
  return rows.map((row) => ({
    deliveredDevices: row.delivered_devices ?? [],
    messageId: row.message_id,
    playedAt: asDate(row.played_at),
    readAt: asDate(row.read_at),
    receiptAt: asDate(row.receipt_at),
    receiptType: row.receipt_type,
    recipientJid: row.recipient_jid,
    updatedAt: asDate(row.updated_at) ?? new Date(),
  }));
}

export async function listPresenceStates(args?: { jid?: string }) {
  let query = chatStateDb
    .selectFrom("whatsapp_presence_states")
    .selectAll()
    .orderBy("updated_at", "desc");
  if (args?.jid) {
    query = query.where("chat_jid", "=", args.jid);
  }
  const rows = await query.execute();
  return rows.map((row) => ({
    chatJid: row.chat_jid,
    lastKnownPresence: row.last_known_presence,
    lastSeen: asDate(row.last_seen),
    participantJid: row.participant_jid,
    updatedAt: asDate(row.updated_at),
  }));
}

export async function getChatThread(args: {
  before?: Date;
  jid?: string;
  limit?: number;
  phone?: string;
}) {
  const limit = args.limit ?? 100;
  let query = chatStateDb
    .selectFrom("whatsapp_messages")
    .selectAll()
    .orderBy("created_at", "desc")
    .limit(limit);

  if (args.jid) {
    query = query.where("remote_jid", "=", args.jid);
  } else if (args.phone) {
    query = query.where("phone", "=", args.phone);
  }

  if (args.before) {
    query = query.where("created_at", "<", args.before);
  }

  const rows = (await query.execute()).reverse();
  const jid = args.jid ?? rows[0]?.remote_jid;
  const messageIds = rows.map((row) => row.message_id);

  const [reactionRows, receiptRows, quotedRows] = await Promise.all([
    jid && messageIds.length
      ? chatStateDb
          .selectFrom("whatsapp_message_reactions")
          .selectAll()
          .where("remote_jid", "=", jid)
          .where("message_id", "in", messageIds)
          .execute()
      : Promise.resolve([]),
    jid && messageIds.length
      ? chatStateDb
          .selectFrom("whatsapp_message_receipts")
          .selectAll()
          .where("remote_jid", "=", jid)
          .where("message_id", "in", messageIds)
          .execute()
      : Promise.resolve([]),
    Promise.all(
      rows
        .map((row) => getQuotedMessageId(row.raw_content_json))
        .filter((value): value is string => Boolean(value))
        .map(async (quotedId) => {
          const row = await chatStateDb
            .selectFrom("whatsapp_messages")
            .select(["message_id", "text_preview"])
            .where("message_id", "=", quotedId)
            .orderBy("created_at", "desc")
            .executeTakeFirst();
          return row ? [quotedId, row.text_preview] : null;
        }),
    ),
  ]);

  const reactionsByMessage = new Map<string, ChatMessageReactionRecord[]>();
  for (const row of reactionRows) {
    const list = reactionsByMessage.get(row.message_id) ?? [];
    list.push({
      actorJid: row.actor_jid,
      emoji: row.emoji,
      messageId: row.message_id,
      removed: row.removed,
      updatedAt: asDate(row.updated_at) ?? new Date(),
    });
    reactionsByMessage.set(row.message_id, list);
  }

  const receiptsByMessage = new Map<string, ChatMessageReceiptRecord[]>();
  for (const row of receiptRows) {
    const list = receiptsByMessage.get(row.message_id) ?? [];
    list.push({
      deliveredDevices: row.delivered_devices ?? [],
      messageId: row.message_id,
      playedAt: asDate(row.played_at),
      readAt: asDate(row.read_at),
      receiptAt: asDate(row.receipt_at),
      receiptType: row.receipt_type,
      recipientJid: row.recipient_jid,
      updatedAt: asDate(row.updated_at) ?? new Date(),
    });
    receiptsByMessage.set(row.message_id, list);
  }

  const quotedPreviewMap = new Map<string, string | null>(
    quotedRows.filter(Boolean) as Array<[string, string | null]>,
  );

  return rows.map((row) => {
    const quotedMessageId = getQuotedMessageId(row.raw_content_json);
    return {
      createdAt: asDate(row.created_at),
      deletedForEveryone: row.deleted_for_everyone,
      deletedForMe: row.deleted_for_me,
      direction: row.direction === "OUTBOUND" ? "outbound" : "inbound",
      fromMe: row.from_me,
      hasMedia: row.has_media,
      mediaMissing: row.media_missing,
      messageId: row.message_id,
      messageType: row.message_type,
      messageTimestamp: asDate(row.message_timestamp),
      participantJid: row.participant_jid,
      phone: row.phone,
      quotedMessageId,
      quotedPreview: quotedMessageId ? quotedPreviewMap.get(quotedMessageId) ?? null : null,
      reactions: reactionsByMessage.get(row.message_id) ?? [],
      receipts: receiptsByMessage.get(row.message_id) ?? [],
      remoteJid: row.remote_jid,
      starred: row.starred,
      status: row.status,
      textPreview: row.text_preview,
      updatedAt: asDate(row.updated_at),
      waId: row.wa_id,
    } satisfies ChatThreadMessageRecord;
  });
}

export async function getChatMeta(args: { jid: string }) {
  const [chat, contact, group, participants, blocked, presence] = await Promise.all([
    chatStateDb
      .selectFrom("whatsapp_chats")
      .selectAll()
      .where("jid", "=", args.jid)
      .executeTakeFirst(),
    chatStateDb
      .selectFrom("whatsapp_contacts")
      .selectAll()
      .where("jid", "=", args.jid)
      .executeTakeFirst(),
    chatStateDb
      .selectFrom("whatsapp_groups")
      .selectAll()
      .where("jid", "=", args.jid)
      .executeTakeFirst(),
    chatStateDb
      .selectFrom("whatsapp_group_participants")
      .selectAll()
      .where("group_jid", "=", args.jid)
      .orderBy("updated_at", "desc")
      .execute(),
    chatStateDb
      .selectFrom("whatsapp_blocked_jids")
      .select(["jid"])
      .where("jid", "=", args.jid)
      .executeTakeFirst(),
    chatStateDb
      .selectFrom("whatsapp_presence_states")
      .selectAll()
      .where("chat_jid", "=", args.jid)
      .orderBy("updated_at", "desc")
      .executeTakeFirst(),
  ]);

  return {
    avatarUrl: chat?.profile_picture_url ?? contact?.img_url ?? null,
    disappearingDuration: chat?.ephemeral_expiration ?? group?.ephemeral_duration ?? null,
    groupMeta: group
      ? {
          desc: group.desc,
          owner: group.owner,
          participants: participants.map((participant) => ({
            admin: participant.admin,
            isSuperAdmin: participant.is_super_admin,
            participantJid: participant.participant_jid,
          })),
          size: group.size,
          subject: group.subject,
        }
      : null,
    isBlocked: Boolean(chat?.is_blocked ?? blocked),
    jid: args.jid,
    name: chat?.name ?? contact?.name ?? contact?.notify ?? contact?.verified_name ?? group?.subject ?? args.jid,
    statusText: presence?.last_known_presence ?? null,
  } satisfies ChatMetaRecord;
}
