import { db } from "@finanzas/db";
import { logError, logEvent } from "../../lib/logger.ts";
import { sendTemplateMessage, sendTextMessage } from "./graph-client.ts";

const POLL_MS = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduledMessageRunner() {
  if (timer) return;
  timer = setInterval(() => {
    void runOnce().catch((err) => logError("[wa-cloud.scheduled.tick]", err));
  }, POLL_MS);
  logEvent("wa-cloud.scheduled.started", { intervalMs: POLL_MS });
}

export function stopScheduledMessageRunner() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

export async function runOnce() {
  const due = await db.waScheduledMessage.findMany({
    where: {
      status: "PENDING",
      scheduledAt: { lte: new Date() },
    },
    include: { conversation: { include: { contact: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 25,
  });

  for (const job of due) {
    try {
      const toE164 = job.conversation.contact.phoneE164;
      let metaId: string | null = null;

      if (job.type === "TEXT") {
        if (!job.body) throw new Error("Scheduled TEXT without body");
        const r = await sendTextMessage({
          phoneNumberId: job.phoneNumberId,
          toE164,
          body: job.body,
          contextMessageId: job.contextMetaMessageId ?? undefined,
        });
        metaId = r.messages?.[0]?.id ?? null;
      } else if (job.type === "TEMPLATE") {
        if (!job.templateName || !job.templateLanguage)
          throw new Error("Scheduled TEMPLATE without name/language");
        const vars = (job.templateVars as unknown as string[]) ?? [];
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
          phoneNumberId: job.phoneNumberId,
          toE164,
          templateName: job.templateName,
          language: job.templateLanguage,
          components,
        });
        metaId = r.messages?.[0]?.id ?? null;
      } else {
        throw new Error(`Unsupported scheduled type: ${job.type}`);
      }

      const now = new Date();
      const preview =
        job.type === "TEMPLATE"
          ? `[plantilla] ${job.templateName}`
          : (job.body ?? "").slice(0, 200);
      const persisted = await db.waMessage.create({
        data: {
          conversationId: job.conversationId,
          contactId: job.contactId,
          phoneNumberId: job.phoneNumberId,
          metaMessageId: metaId,
          direction: "OUTBOUND",
          type: job.type,
          status: "SENT",
          body: job.body,
          templateName: job.templateName,
          templateLanguage: job.templateLanguage,
          sentByUserId: job.createdByUserId,
          contextMetaMessageId: job.contextMetaMessageId,
          payload: { scheduled: true, scheduledMessageId: job.id } as never,
          timestamp: now,
        },
      });
      await db.waConversation.update({
        where: { id: job.conversationId },
        data: { lastMessageAt: now, lastMessagePreview: preview },
      });
      await db.waScheduledMessage.update({
        where: { id: job.id },
        data: { status: "SENT", sentMessageId: persisted.id },
      });
      logEvent("wa-cloud.scheduled.sent", { id: job.id });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await db.waScheduledMessage.update({
        where: { id: job.id },
        data: { status: "FAILED", errorMessage: msg.slice(0, 500) },
      });
      logError("[wa-cloud.scheduled.failed]", err, { id: job.id });
    }
  }
}
