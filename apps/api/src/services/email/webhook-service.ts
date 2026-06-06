import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@finanzas/db";
import { logEvent, logWarn } from "../../lib/logger.ts";

// Resend webhooks are signed with the Svix scheme. We verify manually (no SDK
// dep) and suppress recipients on permanent bounce / spam complaint so we never
// re-mail an address that hard-bounced or marked us spam — the single most
// important thing for keeping sender reputation alive.
//
// Docs: https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
//       https://resend.com/docs/dashboard/webhooks/event-types

const SIGNATURE_TOLERANCE_SECONDS = 300; // reject replays older than 5 min

export interface ResendWebhookHeaders {
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}

/**
 * Verify a Svix-signed Resend webhook against `RESEND_WEBHOOK_SECRET`.
 * `rawBody` MUST be the exact bytes received — any re-stringify breaks the HMAC.
 * Returns false (never throws) on any mismatch so the route can answer 401.
 */
export function verifyResendSignature(rawBody: string, headers: ResendWebhookHeaders): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logWarn("[email.webhook] RESEND_WEBHOOK_SECRET missing — rejecting");
    return false;
  }
  const { svixId, svixTimestamp, svixSignature } = headers;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Replay guard: timestamp must be recent.
  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    logWarn("[email.webhook] timestamp outside tolerance", { ts, nowSeconds });
    return false;
  }

  // Secret is `whsec_<base64>`; the HMAC key is the decoded bytes.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac("sha256", key).update(signedContent).digest(); // raw bytes

  // svix-signature is a space-separated list of `v<version>,<base64sig>`.
  // A match on any v1 entry is success (constant-time compare).
  for (const part of svixSignature.split(" ")) {
    const comma = part.indexOf(",");
    if (comma === -1) continue;
    const version = part.slice(0, comma);
    if (version !== "v1") continue;
    const provided = Buffer.from(part.slice(comma + 1), "base64");
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return true;
    }
  }
  return false;
}

// --- Event payload (only the fields we consume) ---
interface ResendBounce {
  type?: string; // "Permanent" | "Transient" | "Undetermined"
  subType?: string;
  message?: string;
}
interface ResendEventData {
  email_id?: string;
  to?: string[] | string;
  email?: string; // some payload variants use a flat `email`
  subject?: string;
  bounce?: ResendBounce;
}
export interface ResendWebhookEvent {
  type?: string;
  created_at?: string;
  data?: ResendEventData;
}

function recipientsOf(data: ResendEventData | undefined): string[] {
  if (!data) return [];
  if (Array.isArray(data.to)) return data.to.filter(Boolean);
  if (typeof data.to === "string" && data.to) return [data.to];
  if (typeof data.email === "string" && data.email) return [data.email];
  return [];
}

async function suppressRecipients(emails: string[], reason: string): Promise<number> {
  // Resend echoes the exact `to` we sent, which came from Person.email, so an
  // exact match is correct (Prisma `in` doesn't support case-insensitive mode).
  const unique = [...new Set(emails.map((e) => e.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;
  // Idempotent: re-suppressing an already-unsubscribed person is filtered out
  // by `emailUnsubscribedAt: null`, so retries are harmless no-ops.
  const { count } = await db.person.updateMany({
    where: {
      email: { in: unique },
      emailUnsubscribedAt: null,
    },
    data: { emailUnsubscribedAt: new Date(), emailMarketingOptIn: false },
  });
  if (count > 0) logEvent("[email.webhook] suppressed", { count, reason });
  return count;
}

/**
 * Process a verified Resend event. Suppresses on permanent bounce / complaint;
 * everything else is acknowledged and ignored. Always resolves (the route
 * returns 200 so Resend stops retrying) — failures are logged, not thrown.
 */
export async function handleResendEvent(event: ResendWebhookEvent): Promise<void> {
  const recipients = recipientsOf(event.data);
  switch (event.type) {
    case "email.bounced": {
      // Only PERMANENT (hard) bounces suppress. Transient = retryable, keep.
      if (event.data?.bounce?.type === "Permanent") {
        await suppressRecipients(recipients, "hard_bounce");
      } else {
        logEvent("[email.webhook] transient bounce ignored", {
          type: event.data?.bounce?.type,
        });
      }
      return;
    }
    case "email.complained": {
      await suppressRecipients(recipients, "complaint");
      return;
    }
    case "email.suppressed": {
      // Resend put the address on its suppression list — mirror it locally.
      await suppressRecipients(recipients, "provider_suppressed");
      return;
    }
    default:
      // sent/delivered/opened/clicked/etc — acknowledge, no action.
      return;
  }
}
