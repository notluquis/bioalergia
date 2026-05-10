import { db } from "@finanzas/db";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getSessionUser, hasPermission } from "../auth.ts";
import { logWarn } from "../lib/logger.ts";
import { subscribeWaConversation } from "../modules/wa-cloud/events.ts";

export const waCloudSseRoutes = new Hono();

// GET /api/wa-cloud/sse/:conversationId
//
// Streams realtime conversation updates so the intranet stops polling
// every 3s. Events:
//   event: message     data: { messageId, direction, ts }
//   event: status      data: { metaMessageId, status, ts }
//   event: typing      data: { ts }
//   event: reaction    data: { metaMessageId, emoji, ts }
//   event: deleted     data: { metaMessageId, ts }
//   (heartbeat every 25s as :ping comment to keep proxies open)
//
// The client reacts by invalidating React Query cache for the
// conversation (no need to send the message body itself — saves us from
// having to re-serialize and authorize the whole payload here).
waCloudSseRoutes.get("/:conversationId", async (c) => {
  const session = await getSessionUser(c);
  if (!session) return c.text("Unauthorized", 401);
  if (!(await hasPermission(session, "read", "WaBusinessAccount"))) {
    return c.text("Forbidden", 403);
  }
  const conversationId = Number.parseInt(c.req.param("conversationId"), 10);
  if (!Number.isFinite(conversationId)) return c.text("Bad id", 400);

  // Confirm the conversation exists so we don't leak a long-lived stream
  // for a non-existent id.
  const exists = await db.waConversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });
  if (!exists) return c.text("Not found", 404);

  return streamSSE(
    c,
    async (stream) => {
      const queue: Array<() => Promise<void>> = [];
      let drainPromise: Promise<void> | null = null;
      const drain = async () => {
        while (queue.length > 0) {
          const job = queue.shift();
          if (job) await job();
        }
        drainPromise = null;
      };
      const enqueue = (fn: () => Promise<void>) => {
        queue.push(fn);
        if (!drainPromise) drainPromise = drain();
      };

      const unsubscribe = subscribeWaConversation(conversationId, (event) => {
        enqueue(() =>
          stream.writeSSE({ event: event.kind, data: JSON.stringify(event) }),
        );
      });

      // Hello + retry hint so the browser knows to reconnect at 3s if the
      // socket drops mid-stream.
      await stream.writeSSE({ event: "open", data: JSON.stringify({ ts: Date.now() }), retry: 3000 });

      // Heartbeat: keep proxies (Cloudflare/Railway) from killing the
      // connection. SSE comment lines (`: text`) are ignored by clients.
      const HEARTBEAT_MS = 25_000;
      let stopped = false;
      const heartbeat = async () => {
        while (!stopped) {
          await stream.sleep(HEARTBEAT_MS);
          if (stopped) break;
          try {
            await stream.writeSSE({ event: "ping", data: String(Date.now()) });
          } catch {
            stopped = true;
            break;
          }
        }
      };

      // Resolve when the underlying connection aborts.
      stream.onAbort(() => {
        stopped = true;
        unsubscribe();
      });

      try {
        await heartbeat();
      } finally {
        stopped = true;
        unsubscribe();
      }
    },
    async (err, stream) => {
      logWarn("[wa-cloud.sse] stream error", { error: err.message, conversationId });
      try {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ message: err.message }) });
      } catch {
        // already closed
      }
    },
  );
});
