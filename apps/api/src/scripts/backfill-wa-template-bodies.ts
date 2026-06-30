// One-off backfill: re-render the body of historical WhatsApp TEMPLATE messages
// so the inbox shows the actual message text instead of "[plantilla] <name>".
// Idempotent — re-rendering an already-rendered row is a no-op (only rows whose
// body still starts with "[plantilla]" are touched). Also refreshes each
// affected conversation's lastMessagePreview when its newest message is one of
// these templates.
//
// Run: cd apps/api && DATABASE_URL="…" node src/scripts/backfill-wa-template-bodies.ts

import { db } from "@finanzas/db";
import { renderTemplateBody, renderTemplatePreview } from "../modules/wa-cloud/render-template.ts";

async function main(): Promise<void> {
  // Only render rows that were never rendered ("[plantilla] <name>"). Re-running
  // is non-destructive: we intentionally do NOT re-render already-rendered rows,
  // because the stored WaTemplate.components reflect the CURRENT template — if a
  // template's text/buttons changed, re-rendering would rewrite historical
  // messages to a body that was never actually sent. Going forward sendTemplate
  // freezes the rendered body (incl. buttons) at send time. (The one-time
  // backfill that added buttons to pre-existing rendered rows was run separately,
  // accepting that best-effort caveat.)
  const messages = await db.waMessage.findMany({
    where: { type: "TEMPLATE", body: { startsWith: "[plantilla]" } },
    select: {
      id: true,
      conversationId: true,
      phoneNumberId: true,
      templateName: true,
      templateLanguage: true,
      payload: true,
    },
  });
  console.log(`[backfill] ${messages.length} TEMPLATE messages to render`);

  // accountId per phoneNumberId (cache) + template components per key (cache).
  const accountByPhone = new Map<number, number | null>();
  const tplCache = new Map<string, unknown>();
  let rendered = 0;
  let skipped = 0;
  const touchedConversations = new Set<number>();

  for (const m of messages) {
    if (!m.templateName || !m.templateLanguage) {
      skipped++;
      continue;
    }
    if (!accountByPhone.has(m.phoneNumberId)) {
      const phone = await db.waPhoneNumber.findUnique({
        where: { id: m.phoneNumberId },
        select: { accountId: true },
      });
      accountByPhone.set(m.phoneNumberId, phone?.accountId ?? null);
    }
    const accountId = accountByPhone.get(m.phoneNumberId);
    if (accountId == null) {
      skipped++;
      continue;
    }
    const key = `${accountId}|${m.templateName}|${m.templateLanguage}`;
    if (!tplCache.has(key)) {
      const tpl = await db.waTemplate.findFirst({
        where: { accountId, name: m.templateName, language: m.templateLanguage },
        select: { components: true },
      });
      tplCache.set(key, tpl?.components ?? null);
    }
    const components = tplCache.get(key);
    if (components == null) {
      skipped++;
      continue;
    }
    const sent = (m.payload as { components?: unknown } | null)?.components ?? null;
    const body = renderTemplateBody(components, sent);
    if (!body) {
      skipped++;
      continue;
    }
    await db.waMessage.update({ where: { id: m.id }, data: { body } });
    touchedConversations.add(m.conversationId);
    rendered++;
  }

  // Refresh lastMessagePreview where the newest message is a rendered template.
  let previewsUpdated = 0;
  for (const conversationId of touchedConversations) {
    const latest = await db.waMessage.findFirst({
      where: { conversationId },
      orderBy: { timestamp: "desc" },
      select: { type: true, phoneNumberId: true, templateName: true, templateLanguage: true, payload: true },
    });
    if (!latest || latest.type !== "TEMPLATE" || !latest.templateName || !latest.templateLanguage) continue;
    const accountId = accountByPhone.get(latest.phoneNumberId);
    if (accountId == null) continue;
    const components = tplCache.get(`${accountId}|${latest.templateName}|${latest.templateLanguage}`);
    if (components == null) continue;
    const sent = (latest.payload as { components?: unknown } | null)?.components ?? null;
    const preview = renderTemplatePreview(components, sent);
    if (!preview) continue;
    await db.waConversation.update({ where: { id: conversationId }, data: { lastMessagePreview: preview } });
    previewsUpdated++;
  }

  console.log(`[backfill] done: rendered=${rendered} skipped=${skipped} previews=${previewsUpdated}`);
}

await main();
process.exit(0);
