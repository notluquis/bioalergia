// graphile-worker cron task: retry abono WhatsApp sends that failed transiently
// (Meta blip). Two sweeps:
//  - request: PENDING tokens with no waSentAt (the "abona acá" link)
//  - confirmation: APPROVED tokens with no waConfirmSentAt
// Both scans are bounded (take 50 / 7-day window) inside the service fns.
// Inline sends remain the happy path; this is the safety net. Replaces the
// manual-only retry endpoint as the primary recovery mechanism.

import type { Task } from "graphile-worker";
import { retryPendingAbonoConfirmations } from "../../services/abono-confirmation.ts";
import { retryPendingAbonoWhatsapp } from "../../lib/doctoralia/imap-idle.ts";
import { logEvent } from "../../lib/logger.ts";
import { ensureContactAndConversation } from "../../services/wa-contacts.ts";
import { sendTemplate } from "../../services/wa-messages.ts";

export const abono_wa_retry: Task = async () => {
  const request = await retryPendingAbonoWhatsapp({ ensureContactAndConversation, sendTemplate });
  const confirmation = await retryPendingAbonoConfirmations();
  logEvent("queue.abono_wa_retry", { request, confirmation });
};
