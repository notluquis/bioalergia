import { db } from "@finanzas/db";
import { logError, logEvent } from "../../lib/logger.ts";
import { sendTemplateMessage } from "./graph-client.ts";
import { normalizeToE164 } from "./phone.ts";

const POLL_MS = 5_000;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startBroadcastRunner() {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    runOnce()
      .catch((err) => logError("[wa-cloud.broadcast.tick]", err))
      .finally(() => {
        running = false;
      });
  }, POLL_MS);
  logEvent("wa-cloud.broadcast.started", { intervalMs: POLL_MS });
}

export function stopBroadcastRunner() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

async function pickBroadcast() {
  const now = new Date();
  const sending = await db.waBroadcast.findFirst({
    where: { status: "SENDING" },
    orderBy: { startedAt: "asc" },
  });
  if (sending) return sending;
  const queued = await db.waBroadcast.findFirst({
    where: {
      status: "QUEUED",
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }],
    },
    orderBy: { scheduledAt: "asc" },
  });
  if (!queued) return null;
  return db.waBroadcast.update({
    where: { id: queued.id },
    data: { status: "SENDING", startedAt: queued.startedAt ?? now },
  });
}

export async function runOnce() {
  const bc = await pickBroadcast();
  if (!bc) return;

  // Process up to rateLimitPerSecond * 5s = burst per tick.
  const burst = Math.max(1, bc.rateLimitPerSecond * 5);
  const recipients = await db.waBroadcastRecipient.findMany({
    where: { broadcastId: bc.id, status: "PENDING" },
    take: burst,
    orderBy: { id: "asc" },
  });

  if (recipients.length === 0) {
    // Done — finalize counts.
    const final = await db.waBroadcastRecipient.groupBy({
      by: ["status"],
      where: { broadcastId: bc.id },
      _count: { _all: true },
    });
    const sent = final.find((g) => g.status === "SENT")?._count._all ?? 0;
    const failed = final.find((g) => g.status === "FAILED")?._count._all ?? 0;
    await db.waBroadcast.update({
      where: { id: bc.id },
      data: {
        status: "DONE",
        finishedAt: new Date(),
        sentCount: sent,
        failedCount: failed,
      },
    });
    logEvent("wa-cloud.broadcast.done", { id: bc.id, sent, failed });
    return;
  }

  const intervalMs = Math.max(50, Math.floor(1000 / bc.rateLimitPerSecond));
  for (const rec of recipients) {
    try {
      let toE164: string;
      try {
        toE164 = normalizeToE164(rec.phoneE164);
      } catch (err) {
        await db.waBroadcastRecipient.update({
          where: { id: rec.id },
          data: {
            status: "SKIPPED",
            errorMessage: `Invalid phone: ${String(err).slice(0, 200)}`,
            attempts: rec.attempts + 1,
          },
        });
        continue;
      }
      const vars = (rec.variables as unknown as string[]) ?? [];
      const components: Array<{
        type: "body";
        parameters: Array<{ type: "text"; text: string }>;
      }> =
        vars.length > 0
          ? [
              {
                type: "body",
                parameters: vars.map((v) => ({ type: "text" as const, text: v })),
              },
            ]
          : [];
      const r = await sendTemplateMessage({
        phoneNumberId: bc.phoneNumberId,
        toE164,
        templateName: bc.templateName,
        language: bc.templateLanguage,
        components,
      });
      const metaId = r.messages?.[0]?.id ?? null;

      // Best-effort: persist as WaMessage so it appears in the conversation.
      let sentMessageId: number | null = null;
      try {
        const contact = await db.waContact.upsert({
          where: { phoneE164: toE164 },
          create: { phoneE164: toE164 },
          update: {},
        });
        const conv = await db.waConversation.upsert({
          where: { contactId: contact.id },
          create: { contactId: contact.id },
          update: {},
        });
        await db.waConversationChannel.upsert({
          where: {
            conversationId_phoneNumberId: {
              conversationId: conv.id,
              phoneNumberId: bc.phoneNumberId,
            },
          },
          create: { conversationId: conv.id, phoneNumberId: bc.phoneNumberId },
          update: {},
        });
        const now = new Date();
        const persisted = await db.waMessage.create({
          data: {
            conversationId: conv.id,
            contactId: contact.id,
            phoneNumberId: bc.phoneNumberId,
            metaMessageId: metaId,
            direction: "OUTBOUND",
            type: "TEMPLATE",
            status: "SENT",
            templateName: bc.templateName,
            templateLanguage: bc.templateLanguage,
            sentByUserId: bc.createdByUserId,
            payload: { broadcast: true, broadcastId: bc.id, recipientId: rec.id } as never,
            timestamp: now,
          },
        });
        sentMessageId = persisted.id;
        await db.waConversation.update({
          where: { id: conv.id },
          data: {
            lastMessageAt: now,
            lastMessagePreview: `[plantilla] ${bc.templateName}`,
          },
        });
      } catch (err) {
        logError("[wa-cloud.broadcast.persist] failed", err, {
          broadcastId: bc.id,
          recipientId: rec.id,
        });
      }

      await db.waBroadcastRecipient.update({
        where: { id: rec.id },
        data: {
          status: "SENT",
          metaMessageId: metaId,
          sentMessageId,
          sentAt: new Date(),
          attempts: rec.attempts + 1,
        },
      });
      await db.waBroadcast.update({
        where: { id: bc.id },
        data: { sentCount: { increment: 1 } },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.waBroadcastRecipient.update({
        where: { id: rec.id },
        data: {
          status: "FAILED",
          errorMessage: msg.slice(0, 500),
          attempts: rec.attempts + 1,
        },
      });
      await db.waBroadcast.update({
        where: { id: bc.id },
        data: { failedCount: { increment: 1 } },
      });
    }
    // Rate limit pacing.
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs));
  }
}
