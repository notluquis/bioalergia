import { DomainError } from "../../lib/errors.ts";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types.ts";

// Resend REST adapter. Plain fetch (no SDK dep) keeps the layer provider-
// agnostic and trivially swappable to AWS SES — both are just HTTP. Docs:
// https://resend.com/docs/api-reference/emails/send-email
//   - single:  POST /emails        -> { id }
//   - batch:   POST /emails/batch  -> { data: [{ id }, ...] }  (max 100)
//   - rate limit: 5 req/s/team -> 429
//   - idempotency: header `Idempotency-Key`, 24h window

const RESEND_API = "https://api.resend.com";
const MAX_BATCH = 100;

interface ResendErrorBody {
  statusCode?: number;
  message?: string;
  name?: string;
}

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// Resend wire format uses snake_case for reply_to; everything else matches.
function toResendPayload(m: EmailMessage, defaultFrom: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from: m.from ?? defaultFrom,
    to: toArray(m.to),
    subject: m.subject,
  };
  if (m.html !== undefined) payload.html = m.html;
  if (m.text !== undefined) payload.text = m.text;
  if (m.replyTo !== undefined) payload.reply_to = m.replyTo;
  if (m.cc !== undefined) payload.cc = toArray(m.cc);
  if (m.bcc !== undefined) payload.bcc = toArray(m.bcc);
  if (m.headers !== undefined) payload.headers = m.headers;
  return payload;
}

// Map a non-2xx Resend response onto a typed DomainError so the oRPC
// boundary returns the right HTTP status instead of a 500.
function raiseForStatus(status: number, body: ResendErrorBody): never {
  const message = body.message ?? `Resend error ${status}`;
  const details = { provider: "resend", resendName: body.name, status };
  switch (status) {
    case 401:
    case 403:
      throw new DomainError("UNAUTHORIZED", `Email auth rechazada: ${message}`, details);
    case 422:
      throw new DomainError("UNPROCESSABLE_ENTITY", `Email inválido: ${message}`, details);
    case 429:
      throw new DomainError("RATE_LIMITED", `Email rate limit: ${message}`, details);
    default:
      throw new DomainError("BAD_REQUEST", `Email falló: ${message}`, details);
  }
}

async function parseJson(res: Response): Promise<unknown> {
  const raw = await res.text();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { message: raw };
  }
}

export function createResendProvider(apiKey: string, defaultFrom = ""): EmailProvider {
  const authHeaders = (idempotencyKey?: string): Record<string, string> => {
    const h: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (idempotencyKey) h["Idempotency-Key"] = idempotencyKey;
    return h;
  };

  return {
    name: "resend",
    maxBatchSize: MAX_BATCH,

    async send(message: EmailMessage): Promise<EmailSendResult> {
      const res = await fetch(`${RESEND_API}/emails`, {
        method: "POST",
        headers: authHeaders(message.idempotencyKey),
        body: JSON.stringify(toResendPayload(message, defaultFrom)),
      });
      const body = await parseJson(res);
      if (!res.ok) raiseForStatus(res.status, body as ResendErrorBody);
      const id = (body as { id?: string }).id ?? null;
      return { id, to: toArray(message.to), ok: true };
    },

    async sendBatch(messages: EmailMessage[]): Promise<EmailSendResult[]> {
      if (messages.length === 0) return [];
      if (messages.length > MAX_BATCH) {
        throw new DomainError(
          "BAD_REQUEST",
          `Batch excede el máximo de ${MAX_BATCH} (recibidos ${messages.length})`,
          { provider: "resend" }
        );
      }
      // Batch endpoint takes the SAME idempotency key for the whole call;
      // per-message keys aren't supported, so reuse the first if present.
      const idempotencyKey = messages.find((m) => m.idempotencyKey)?.idempotencyKey;
      const res = await fetch(`${RESEND_API}/emails/batch`, {
        method: "POST",
        headers: authHeaders(idempotencyKey),
        body: JSON.stringify(messages.map((m) => toResendPayload(m, defaultFrom))),
      });
      const body = await parseJson(res);
      if (!res.ok) raiseForStatus(res.status, body as ResendErrorBody);
      const data = (body as { data?: Array<{ id?: string }> }).data ?? [];
      return messages.map((m, i) => ({
        id: data[i]?.id ?? null,
        to: toArray(m.to),
        ok: true,
      }));
    },
  };
}
