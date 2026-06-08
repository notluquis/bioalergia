// graphile-worker task: auto-drain an outreach campaign.
//
// Enqueued by the launchCampaign / resume handler (jobKey
// `outreach_drain_<campaignId>`, replace mode → one chain per campaign). Each
// tick sends one batch via sendOutreachNextBatch (which owns the per-hour rate
// cap + status bookkeeping) and re-enqueues itself, paced to ratePerHour, until
// nothing is pending or the campaign leaves ENVIANDO (paused/completed).
//
// Pacing: to emit `ratePerHour` mails/hour in batches of B, the gap between
// ticks is 3600·B / ratePerHour seconds. The service-side trailing-hour cap is
// the hard guard; this pacing just keeps ticks from busy-spinning.

import { db } from "@finanzas/db";
import type { Task } from "graphile-worker";
import { logEvent } from "../../lib/logger.ts";
import { sendOutreachNextBatch } from "../../services/outreach-email.ts";

const BATCH = Math.max(1, Math.min(100, Number(process.env.OUTREACH_DRAIN_BATCH) || 10));

export function outreachDrainJobKey(campaignId: number): string {
  return `outreach_drain_${campaignId}`;
}

export const send_outreach_tick: Task = async (payload, helpers) => {
  const { campaignId } = payload as { campaignId: number };

  const campaign = await db.outreachEmailCampaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.estado !== "ENVIANDO") {
    helpers.logger.info(
      `send_outreach_tick.stop campaign=${campaignId} estado=${campaign?.estado ?? "missing"}`
    );
    return; // paused / completed / cancelled / deleted — break the chain
  }

  const res = await sendOutreachNextBatch(campaignId, BATCH);
  logEvent("queue.outreach_tick", { campaignId, ...res, batch: BATCH });

  if (res.remaining === 0) return; // service already flipped to COMPLETADA

  const gapSec = Math.max(5, Math.ceil((3600 * BATCH) / campaign.ratePerHour));
  await helpers.addJob(
    "send_outreach_tick",
    { campaignId },
    {
      runAt: new Date(Date.now() + gapSec * 1000),
      jobKey: outreachDrainJobKey(campaignId),
      jobKeyMode: "replace",
    }
  );
};
