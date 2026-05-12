import { EventEmitter } from "node:events";

// In-process pub/sub for wa-cloud realtime updates. Single API instance
// only — for multi-instance deploys, swap this for Redis pub/sub or
// Postgres LISTEN/NOTIFY behind the same interface. Today (single Railway
// service) the in-memory bus is the simplest correct option.

export type WaConversationEvent =
  | { kind: "message"; messageId: number; direction: "INBOUND" | "OUTBOUND"; ts: number }
  | { kind: "status"; metaMessageId: string; status: string; ts: number }
  | { kind: "typing"; ts: number }
  | { kind: "reaction"; metaMessageId: string; emoji: string; ts: number }
  | { kind: "deleted"; metaMessageId: string; ts: number };

const bus = new EventEmitter();
// Many concurrent SSE clients are expected (one per open conversation tab
// per user). Default 10-listener cap throws warnings; raise it.
bus.setMaxListeners(0);

function topic(conversationId: number): string {
  return `wa:conv:${conversationId}`;
}

export function emitWaEvent(conversationId: number, event: WaConversationEvent): void {
  bus.emit(topic(conversationId), event);
}

export function subscribeWaConversation(
  conversationId: number,
  listener: (e: WaConversationEvent) => void
): () => void {
  const t = topic(conversationId);
  bus.on(t, listener);
  return () => bus.off(t, listener);
}

// Best-effort emit for cases where we have a metaMessageId but no
// conversationId yet (rare). Skip if no map can be done by the caller.
export function emitToConversationByMessage(
  conversationId: number | null | undefined,
  event: WaConversationEvent
): void {
  if (typeof conversationId === "number") emitWaEvent(conversationId, event);
}
