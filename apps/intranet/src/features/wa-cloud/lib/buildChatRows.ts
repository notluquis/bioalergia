import { chileDay } from "@/lib/dates";
import type { MessageStatus } from "../components/shared/_shared";
import { dayLabel } from "../components/shared/_shared";

// Pure feed builder: merges server messages + optimistic pending sends into a
// time-sorted list of rows with day dividers and consecutive-message grouping
// flags. Extracted from ConversationDetail so it can be unit-tested in isolation.

const GROUP_WINDOW_MS = 5 * 60_000;

// Types that always carry their own timestamp/footer and never collapse into a
// text group (media + structured messages).
const STANDALONE_TYPES = new Set([
  "IMAGE",
  "STICKER",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "LOCATION",
  "CONTACTS",
  "INTERACTIVE",
  "TEMPLATE",
  "UNSUPPORTED",
]);

export type RawMessage = {
  id: number | string;
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  type: string;
  timestamp: Date | string;
  status: string;
  errorTitle?: string | null;
  errorDetails?: string | null;
  templateName?: string | null;
  metaMessageId?: string | null;
  contextMetaMessageId?: string | null;
  payload?: unknown;
};

export type PendingRaw = {
  cid: string;
  body: string;
  timestamp: Date;
  status: "PENDING" | "FAILED";
};

export type ReactionInfo = { emoji: string; out: boolean };

export type ChatMessageRow = {
  kind: "message";
  key: string;
  messageId: number | null;
  metaMessageId: string | null;
  pendingCid: string | null;
  out: boolean;
  body: string | null;
  type: string;
  timestamp: Date;
  status: MessageStatus;
  errorTitle?: string | null;
  errorDetails?: string | null;
  templateName?: string | null;
  quotedSnippet?: { body: string; out: boolean } | null;
  reactions?: ReactionInfo[];
  payload?: unknown;
  groupStart: boolean;
  groupEnd: boolean;
};

export type ChatRow = { kind: "divider"; key: string; label: string } | ChatMessageRow;

export function buildChatRows(messages: RawMessage[], pending: PendingRaw[]): ChatRow[] {
  // Index by metaMessageId so quoted replies can resolve their target.
  const byMetaId = new Map<string, RawMessage>();
  for (const m of messages) {
    if (m.metaMessageId) byMetaId.set(m.metaMessageId, m);
  }

  // Group REACTION messages onto their target so they render as floating chips,
  // not standalone rows. Empty body = reaction removed → skip.
  const reactionsByTarget = new Map<string, ReactionInfo[]>();
  for (const m of messages) {
    if (m.type === "REACTION" && m.contextMetaMessageId && m.body?.trim()) {
      const arr = reactionsByTarget.get(m.contextMetaMessageId) ?? [];
      arr.push({ emoji: m.body.trim(), out: m.direction === "OUTBOUND" });
      reactionsByTarget.set(m.contextMetaMessageId, arr);
    }
  }

  type Combined = {
    src: "server" | "pending";
    id: number | string;
    direction: "INBOUND" | "OUTBOUND";
    body: string | null;
    type: string;
    timestamp: Date;
    status: string;
    errorTitle?: string | null;
    errorDetails?: string | null;
    templateName?: string | null;
    metaMessageId: string | null;
    contextMetaMessageId: string | null;
    payload?: unknown;
  };

  const serverMsgs: Combined[] = messages
    .filter((m) => m.type !== "REACTION")
    .map((m) => ({
      src: "server",
      id: m.id,
      direction: m.direction,
      body: m.body,
      type: m.type,
      timestamp: new Date(m.timestamp),
      status: m.status,
      errorTitle: m.errorTitle,
      errorDetails: m.errorDetails,
      templateName: m.templateName,
      metaMessageId: m.metaMessageId ?? null,
      contextMetaMessageId: m.contextMetaMessageId ?? null,
      payload: m.payload,
    }));

  const pendingMsgs: Combined[] = pending.map((p) => ({
    src: "pending",
    id: p.cid,
    direction: "OUTBOUND",
    body: p.body,
    type: "TEXT",
    timestamp: p.timestamp,
    status: p.status,
    metaMessageId: null,
    contextMetaMessageId: null,
  }));

  const combined = [...serverMsgs, ...pendingMsgs].sort((a, b) => +a.timestamp - +b.timestamp);

  const rows: ChatRow[] = [];
  let lastDay = "";
  let prev: { row: ChatMessageRow; ts: number; out: boolean; standalone: boolean } | null = null;

  for (const m of combined) {
    const out = m.direction === "OUTBOUND";
    const day = chileDay(m.timestamp);
    if (day !== lastDay) {
      rows.push({ kind: "divider", key: `d-${day}`, label: dayLabel(m.timestamp) });
      lastDay = day;
      prev = null;
    }

    const standalone = STANDALONE_TYPES.has(m.type);
    const continuation =
      prev !== null &&
      prev.out === out &&
      !prev.standalone &&
      !standalone &&
      m.timestamp.getTime() - prev.ts <= GROUP_WINDOW_MS;
    if (continuation && prev) prev.row.groupEnd = false;

    let quoted: { body: string; out: boolean } | null = null;
    if (m.contextMetaMessageId) {
      const target = byMetaId.get(m.contextMetaMessageId);
      if (target) {
        quoted = {
          body: target.body ?? `[${target.type.toLowerCase()}]`,
          out: target.direction === "OUTBOUND",
        };
      }
    }

    const msgRow: ChatMessageRow = {
      kind: "message",
      key: `${m.src}-${m.id}`,
      messageId: m.src === "server" ? Number(m.id) : null,
      metaMessageId: m.metaMessageId,
      pendingCid: m.src === "pending" ? String(m.id) : null,
      out,
      body: m.body,
      type: m.type,
      timestamp: m.timestamp,
      status: m.status as MessageStatus,
      errorTitle: m.errorTitle,
      errorDetails: m.errorDetails,
      templateName: m.templateName,
      quotedSnippet: quoted,
      reactions: m.metaMessageId ? reactionsByTarget.get(m.metaMessageId) : undefined,
      payload: m.payload,
      groupStart: !continuation,
      groupEnd: true,
    };
    rows.push(msgRow);
    prev = { row: msgRow, ts: m.timestamp.getTime(), out, standalone };
  }

  return rows;
}

// Key of the first unread inbound message, given the conversation's unreadCount.
// Counts inbound messages from the end; the (unreadCount)-th from the end is the
// boundary. Returns null when there's nothing unread.
export function firstUnreadKey(rows: ChatRow[], unreadCount: number): string | null {
  if (unreadCount <= 0) return null;
  const inbound = rows.filter((r): r is ChatMessageRow => r.kind === "message" && !r.out);
  if (inbound.length === 0) return null;
  const idx = Math.max(0, inbound.length - unreadCount);
  return inbound[idx]?.key ?? null;
}
