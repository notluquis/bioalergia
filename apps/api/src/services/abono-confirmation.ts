// Abono payment confirmation WhatsApp send.
//
// In services/ (not lib/) because it imports modules/wa-cloud — lib is a
// composite leaf with isolatedDeclarations and may only depend on lower tiers.
// Called by the MP webhook (immediate) and the abono_wa_retry cron (safety net).
//
// ONE generic template, named params: nombre, monto_pagado, valor_consulta.
// The template text covers both "abono" (50%) and "pago completo" (100%) —
// the amount param disambiguates, so no per-previsión/per-pct variants.

import { db } from "@finanzas/db";
import {
  findAbonoWhatsappPhone,
  loadAbonoWhatsappConfig,
  loadClinicLocation,
} from "../lib/doctoralia/abono-whatsapp-settings.ts";
import { appendAbonoFlowHistory } from "../lib/doctoralia/abono-flow-history.ts";
import { logError, logEvent } from "../lib/logger.ts";
import { sendTemplateMessage } from "../modules/wa-cloud/graph-client.ts";

export async function sendAbonoConfirmation(tokenId: string): Promise<void> {
  const token = await db.appointmentPaymentToken.findUnique({ where: { id: tokenId } });
  if (!token) return;
  if (!token.patientPhone) {
    await appendAbonoFlowHistory(token.id, "wa_confirmation_invalid_token", {
      field: "patientPhone",
    });
    return;
  }
  if (token.waConfirmSentAt) return;

  const waConfig = await loadAbonoWhatsappConfig("confirmation");
  if (!waConfig.enabled) {
    logEvent("mp-webhook.abono_wa_confirm_skipped", {
      reason: "disabled_by_setting",
      tokenId,
    });
    await appendAbonoFlowHistory(token.id, "wa_confirmation_disabled");
    return;
  }
  if (!waConfig.templateName) {
    throw new Error("Setting doctoralia.abono.whatsapp.confirmationTemplatePrefix requerido");
  }
  if (!waConfig.language) {
    throw new Error("Setting doctoralia.abono.whatsapp.confirmationTemplateLanguage requerido");
  }
  if (!waConfig.phoneNumberId) {
    throw new Error("Setting doctoralia.abono.whatsapp.phoneNumberId requerido");
  }

  const waPhone = await findAbonoWhatsappPhone(waConfig);
  if (!waPhone) {
    throw new Error(
      `No active WA phone for abono confirmation (configured=${waConfig.phoneNumberId ?? "none"})`
    );
  }

  const firstName = token.patientName.split(" ")[0] ?? token.patientName;
  const clp = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
  const paidText = clp(token.paidAmountClp ?? 0);
  const consultaText = clp(token.fullAmountClp);
  const templateName = waConfig.templateName;

  const clinicLocation = await loadClinicLocation();

  await sendTemplateMessage({
    phoneNumberId: Number(waPhone.id),
    toE164: token.patientPhone,
    templateName,
    language: waConfig.language,
    components: [
      ...(clinicLocation
        ? [
            {
              type: "header" as const,
              parameters: [{ type: "location" as const, location: clinicLocation }],
            },
          ]
        : []),
      {
        type: "body" as const,
        parameters: [
          { type: "text" as const, parameter_name: "nombre", text: firstName },
          { type: "text" as const, parameter_name: "monto_pagado", text: paidText },
          { type: "text" as const, parameter_name: "valor_consulta", text: consultaText },
        ],
      },
    ],
  });

  await db.appointmentPaymentToken.update({
    where: { id: token.id },
    data: { waConfirmSentAt: new Date() },
  });
  await appendAbonoFlowHistory(token.id, "wa_confirmation_sent", {
    phoneNumberId: waPhone.id,
    templateName,
  });
}

// Retry net for confirmations that never sent (Meta blip when the webhook ran).
// Scans APPROVED tokens paid in the last 7 days with no waConfirmSentAt.
// ponytail: 7-day window bounds the scan; widen if confirmations lag longer.
export async function retryPendingAbonoConfirmations(): Promise<{
  checked: number;
  sent: number;
  failed: number;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const tokens = await db.appointmentPaymentToken.findMany({
    where: {
      status: "APPROVED",
      waConfirmSentAt: null,
      paidAt: { gt: sevenDaysAgo },
    },
    orderBy: { paidAt: "asc" },
    take: 50,
  });
  const result = { checked: tokens.length, sent: 0, failed: 0 };
  for (const token of tokens) {
    try {
      await sendAbonoConfirmation(token.id);
      result.sent++;
    } catch (error) {
      result.failed++;
      await appendAbonoFlowHistory(token.id, "wa_confirmation_retry_failed", {}, error);
      logError("doctoralia.abono.confirmation_retry_error", error, { tokenId: token.id });
    }
  }
  return result;
}
