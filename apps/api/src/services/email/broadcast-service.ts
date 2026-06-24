import { randomBytes } from "node:crypto";
import { db } from "@finanzas/db";
import { DomainError } from "../../lib/errors.ts";
import { sanitizeHtml } from "../../lib/html-sanitizer.ts";
import { logEvent } from "../../lib/logger.ts";
import { sendBroadcast, sendEmail } from "./index.ts";
import type { EmailMessage, EmailSendResult } from "./types.ts";

// Patient broadcast: contacts live in OUR DB (Person). Recipients are the
// persons who (a) have an email, (b) opted in, and (c) haven't unsubscribed.
// Transactional mail bypasses all of this — it's not marketing.

const RECIPIENT_WHERE = {
  email: { not: null },
  emailMarketingOptIn: true,
  emailUnsubscribedAt: null,
} as const;

function unsubscribeBaseUrl(): string {
  const base = process.env.PUBLIC_URL;
  if (!base) {
    throw new DomainError("CONFLICT", "PUBLIC_URL no configurado (link de baja).", {});
  }
  return base.replace(/\/+$/, "");
}

export async function countBroadcastRecipients(): Promise<number> {
  return db.person.count({ where: RECIPIENT_WHERE });
}

interface RecipientRow {
  id: number;
  email: string | null;
  emailUnsubscribeToken: string | null;
}

// Mint missing unsubscribe tokens in one pass and return email -> token so the
// List-Unsubscribe URL can be built per recipient without leaking the row id.
async function ensureTokens(rows: RecipientRow[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!row.email) continue;
    let token = row.emailUnsubscribeToken;
    if (!token) {
      token = randomBytes(24).toString("hex");
      await db.person.update({
        where: { id: row.id },
        data: { emailUnsubscribeToken: token },
      });
    }
    map.set(row.email, token);
  }
  return map;
}

export interface BroadcastInput {
  subject: string;
  html: string;
  text?: string;
  dryRun: boolean;
}

export interface BroadcastOutcome {
  dryRun: boolean;
  recipients: number;
  sent: number;
  failed: number;
}

export async function sendPatientBroadcast(input: BroadcastInput): Promise<BroadcastOutcome> {
  const rows = (await db.person.findMany({
    where: RECIPIENT_WHERE,
    select: { id: true, email: true, emailUnsubscribeToken: true },
  })) as RecipientRow[];

  const recipients = rows.filter((r): r is RecipientRow & { email: string } => Boolean(r.email));

  if (input.dryRun) {
    logEvent("[email] broadcast dry-run", { recipients: recipients.length });
    return { dryRun: true, recipients: recipients.length, sent: 0, failed: 0 };
  }
  if (recipients.length === 0) {
    return { dryRun: false, recipients: 0, sent: 0, failed: 0 };
  }

  const tokens = await ensureTokens(recipients);
  const base = unsubscribeBaseUrl();
  // Sanitize once — the same body goes to everyone.
  const html = sanitizeHtml(input.html);

  const messages: EmailMessage[] = recipients.map((r) => ({
    to: r.email,
    subject: input.subject,
    html,
    text: input.text,
  }));

  const results: EmailSendResult[] = await sendBroadcast(messages, {
    unsubscribeUrlFor: (to) => {
      const token = tokens.get(to);
      return token ? `${base}/api/email/unsubscribe/${token}` : `${base}/api/email/unsubscribe`;
    },
  });

  const sent = results.filter((r) => r.ok).length;
  return {
    dryRun: false,
    recipients: recipients.length,
    sent,
    failed: results.length - sent,
  };
}

export interface TestEmailInput {
  to: string;
  subject: string;
  message: string;
}

export async function sendTransactionalTest(input: TestEmailInput): Promise<EmailSendResult> {
  return sendEmail({
    to: input.to,
    subject: input.subject,
    html: `<p>${sanitizeHtml(input.message)}</p>`,
    text: input.message,
    idempotencyKey: `test/${input.to}/${input.subject}`,
  });
}

export interface PatientOptInState {
  personId: number;
  email: string | null;
  optIn: boolean;
  optInAt: Date | null;
  unsubscribedAt: Date | null;
}

export async function getPatientEmailOptIn(personId: number): Promise<PatientOptInState> {
  const person = await db.person.findUnique({
    where: { id: personId },
    select: {
      id: true,
      email: true,
      emailMarketingOptIn: true,
      emailMarketingOptInAt: true,
      emailUnsubscribedAt: true,
    },
  });
  if (!person) {
    throw new DomainError("NOT_FOUND", "Persona no encontrada.", { personId });
  }
  return {
    personId: person.id,
    email: person.email,
    optIn: person.emailMarketingOptIn,
    optInAt: person.emailMarketingOptInAt,
    unsubscribedAt: person.emailUnsubscribedAt,
  };
}

// Operator-driven opt-in toggle in the ficha. Turning ON re-consents: it stamps
// optInAt AND clears any prior unsubscribe (the patient explicitly opted back in
// via staff). Turning OFF stamps unsubscribedAt so they're excluded from blasts.
export async function setPatientEmailOptIn(
  personId: number,
  optIn: boolean
): Promise<PatientOptInState> {
  const exists = await db.person.findUnique({ where: { id: personId }, select: { id: true } });
  if (!exists) {
    throw new DomainError("NOT_FOUND", "Persona no encontrada.", { personId });
  }
  const now = new Date();
  await db.person.update({
    where: { id: personId },
    data: optIn
      ? { emailMarketingOptIn: true, emailMarketingOptInAt: now, emailUnsubscribedAt: null }
      : { emailMarketingOptIn: false, emailUnsubscribedAt: now },
  });
  logEvent("[email] opt-in toggled", { personId, optIn });
  return getPatientEmailOptIn(personId);
}

export interface UnsubscribeOutcome {
  ok: boolean;
  alreadyUnsubscribed: boolean;
}

// Public one-click unsubscribe. Idempotent: a second click is a no-op success.
export async function unsubscribeByToken(token: string): Promise<UnsubscribeOutcome> {
  const trimmed = token.trim();
  if (!trimmed) {
    throw new DomainError("BAD_REQUEST", "Token de baja vacío.", {});
  }
  const person = await db.person.findUnique({
    where: { emailUnsubscribeToken: trimmed },
    select: { id: true, emailUnsubscribedAt: true },
  });
  if (!person) {
    throw new DomainError("NOT_FOUND", "Token de baja inválido.", {});
  }
  if (person.emailUnsubscribedAt) {
    return { ok: true, alreadyUnsubscribed: true };
  }
  await db.person.update({
    where: { id: person.id },
    data: { emailUnsubscribedAt: new Date(), emailMarketingOptIn: false },
  });
  logEvent("[email] unsubscribed", { personId: person.id });
  return { ok: true, alreadyUnsubscribed: false };
}
