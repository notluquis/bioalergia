import { db } from "@finanzas/db";
import { DomainError } from "../lib/errors.ts";
import { buildCampaignDeliveries } from "../modules/outreach/campaign-builder.ts";

// Launch (BORRADOR) or resume (PAUSADA) an outreach campaign. Returns the
// updated campaign row; the caller normalizes + kicks off the drain chain.
//
// Only a fresh launch rebuilds deliveries from the current filters. Resume
// keeps the existing PENDIENTE/ENVIADO rows so already-contacted
// establishments are never re-mailed.
export async function launchOrResumeCampaign(campaignId: number) {
  const existing = await db.outreachEmailCampaign.findUnique({ where: { id: campaignId } });
  if (!existing) throw new DomainError("NOT_FOUND", "Campaña no encontrada");
  if (existing.estado === "COMPLETADA") {
    throw new DomainError("CONFLICT", "La campaña ya está completada");
  }

  if (existing.estado === "BORRADOR") {
    await buildCampaignDeliveries(campaignId);
  }

  return db.outreachEmailCampaign.update({
    where: { id: campaignId },
    data: { estado: "ENVIANDO", enviadoEn: existing.enviadoEn ?? new Date() },
  });
}
