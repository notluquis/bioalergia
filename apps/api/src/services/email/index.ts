import { resendApiKey } from "../../lib/config.ts";
import { DomainError } from "../../lib/errors.ts";
import { logError, logEvent } from "../../lib/logger.ts";
import { loadSettings } from "../../lib/settings.ts";
import { createResendProvider } from "./resend-provider.ts";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types.ts";

export type { EmailMessage, EmailProvider, EmailSendResult } from "./types.ts";

// Lazily built singleton — the API key (env secret) is read at first use, so the
// API boots fine when email isn't configured (dev, CI).
let provider: EmailProvider | null = null;

/** Throws CONFLICT if the API key (RESEND_API_KEY) isn't set. */
export function getEmailProvider(): EmailProvider {
  if (!resendApiKey) {
    throw new DomainError("CONFLICT", "Email no configurado. Falta RESEND_API_KEY.", {
      hint: "Set RESEND_API_KEY in the Railway api service.",
    });
  }
  provider ??= createResendProvider(resendApiKey);
  return provider;
}

export function isEmailConfigured(): boolean {
  return Boolean(resendApiKey);
}

export interface EmailSenders {
  from: string;
  broadcastFrom: string;
  replyTo: string;
}

// Non-secret sender config from DB settings (email.* keys), with the defaults
// in lib/settings.ts. One findMany per resolve — cheap at our volume; callers
// that send in bulk resolve once and reuse.
export async function getEmailSenders(): Promise<EmailSenders> {
  const s = await loadSettings();
  return {
    from: s.emailFrom,
    broadcastFrom: s.emailBroadcastFrom || s.emailFrom,
    replyTo: s.emailReplyTo,
  };
}

/** Send a single transactional email (reset, magic link, appointment reminder). */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const senders = await getEmailSenders();
  const result = await getEmailProvider().send({
    ...message,
    from: message.from ?? senders.from,
    replyTo: message.replyTo ?? (senders.replyTo || undefined),
  });
  logEvent("[email] sent", { to: result.to, id: result.id, idem: message.idempotencyKey });
  return result;
}

/**
 * Send many messages, auto-chunked to the provider's batch cap. Each chunk is
 * one API round-trip. A chunk that throws (rate limit, auth) aborts the rest —
 * callers that want best-effort per-recipient should catch and inspect the
 * partial array length against the input.
 */
export async function sendEmailBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
  if (messages.length === 0) return [];
  const senders = await getEmailSenders();
  const p = getEmailProvider();
  const results: EmailSendResult[] = [];
  for (let i = 0; i < messages.length; i += p.maxBatchSize) {
    const chunk = messages
      .slice(i, i + p.maxBatchSize)
      .map((m) => ({ ...m, from: m.from ?? senders.from }));
    results.push(...(await p.sendBatch(chunk)));
  }
  logEvent("[email] batch sent", {
    count: results.length,
    chunks: Math.ceil(messages.length / p.maxBatchSize),
  });
  return results;
}

/**
 * Build the List-Unsubscribe headers (RFC 8058 one-click) Gmail/Yahoo require
 * for bulk mail. `unsubscribeUrl` should be a POST-able endpoint that flags the
 * contact opted-out in our DB. Spread onto a broadcast message's `headers`.
 */
export function listUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Best-effort broadcast: sends from the configured broadcast sender, attaches
 * one-click unsubscribe headers, and never throws on a single bad recipient —
 * failures are demoted to `{ ok: false, error }` so one poison address can't
 * kill the whole run (lesson #26: per-item try/catch on batch processing).
 */
export async function sendBroadcast(
  messages: EmailMessage[],
  opts: { unsubscribeUrlFor: (to: string) => string }
): Promise<EmailSendResult[]> {
  if (messages.length === 0) return [];
  const senders = await getEmailSenders();
  const prepared: EmailMessage[] = messages.map((m) => {
    const to = Array.isArray(m.to) ? m.to[0] : m.to;
    return {
      ...m,
      from: m.from ?? senders.broadcastFrom,
      replyTo: m.replyTo ?? (senders.replyTo || undefined),
      headers: { ...m.headers, ...listUnsubscribeHeaders(opts.unsubscribeUrlFor(to ?? "")) },
    };
  });

  const p = getEmailProvider();
  const results: EmailSendResult[] = [];
  for (let i = 0; i < prepared.length; i += p.maxBatchSize) {
    const chunk = prepared.slice(i, i + p.maxBatchSize);
    try {
      results.push(...(await p.sendBatch(chunk)));
    } catch (err) {
      logError(err, { module: "api", operation: "email.broadcast.chunk", offset: i });
      for (const m of chunk) {
        results.push({
          id: null,
          to: Array.isArray(m.to) ? m.to : [m.to],
          ok: false,
          error: err instanceof Error ? err.message : "send failed",
        });
      }
    }
  }
  logEvent("[email] broadcast done", {
    total: results.length,
    ok: results.filter((r) => r.ok).length,
  });
  return results;
}
