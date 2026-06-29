// Rutas públicas (sin auth) para el flujo de pago de primera visita.
//
// GET  /api/abono/:token  — datos del token (para renderizar la página)
// POST /api/abono/:token  — crea preference MP con el monto elegido

import { db } from "@finanzas/db";
import { MercadoPagoConfig, Preference } from "mercadopago";
import type { Hono } from "hono";
import {
  loadAbonoPaymentSettings,
  loadAbonoPricingSettings,
} from "../lib/doctoralia/abono-whatsapp-settings.ts";
import { appendAbonoFlowHistory } from "../lib/doctoralia/abono-flow-history.ts";

function mpClient() {
  const token = process.env.MP_ACCESS_TOKEN ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MP_ACCESS_TOKEN no configurado");
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 8000 } });
}

export function registerAbonoRoutes(app: Hono) {
  // GET — datos del token para la página
  app.get("/api/abono/:token", async (c) => {
    const token = await db.appointmentPaymentToken.findUnique({
      where: { id: c.req.param("token") },
    });
    if (!token) return c.json({ error: "not_found" }, 404);
    if (token.status === "EXPIRED" || (token.expiresAt < new Date() && token.status === "PENDING")) {
      return c.json({ error: "expired" }, 410);
    }
    const pricing = await loadAbonoPricingSettings();
    return c.json({
      id: token.id,
      patientName: token.patientName,
      appointmentDate: token.appointmentDate,
      doctorName: token.doctorName,
      serviceName: token.serviceName,
      isFonasa: token.isFonasa,
      fullAmountClp: token.fullAmountClp,
      halfAmountClp: token.halfAmountClp,
      status: token.status,
      paidAmountClp: token.paidAmountClp,
      paidAt: token.paidAt,
      pricing: {
        fonasaFullAmountClp: pricing.fonasaFullAmountClp,
        particularFullAmountClp: pricing.particularFullAmountClp,
      },
    });
  });

  // POST — elegir monto e iniciar preference de MP (Checkout Pro redirect)
  app.post("/api/abono/:token", async (c) => {
    const tokenId = c.req.param("token");
    let body: { amount?: unknown; insuranceType?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }
    if (body.amount !== "half" && body.amount !== "full") {
      return c.json({ error: "amount must be half or full" }, 400);
    }
    if (body.insuranceType !== "fonasa" && body.insuranceType !== "particular") {
      return c.json({ error: "invalid insurance type" }, 400);
    }

    let token = await db.appointmentPaymentToken.findUnique({
      where: { id: tokenId },
    });
    if (!token) return c.json({ error: "not_found" }, 404);
    if (token.status !== "PENDING") return c.json({ error: "already_paid" }, 409);
    if (token.expiresAt < new Date()) return c.json({ error: "expired" }, 410);

    const isFonasa = body.insuranceType === "fonasa";
    let paymentSettings: Awaited<ReturnType<typeof loadAbonoPaymentSettings>>;
    try {
      paymentSettings = await loadAbonoPaymentSettings();
    } catch (error) {
      await appendAbonoFlowHistory(token.id, "mp_preference_settings_error", {}, error);
      throw error;
    }
    const fullAmountClp = isFonasa
      ? paymentSettings.fonasaFullAmountClp
      : paymentSettings.particularFullAmountClp;
    const halfAmountClp = Math.round(fullAmountClp / 2);

    token = await db.appointmentPaymentToken.update({
      where: { id: tokenId },
      data: { isFonasa, fullAmountClp, halfAmountClp },
    });
    await appendAbonoFlowHistory(token.id, "mp_preference_requested", {
      amount: body.amount,
      insuranceType: body.insuranceType,
    });

    const amountClp = body.amount === "half" ? token.halfAmountClp : token.fullAmountClp;
    const successUrl = `${paymentSettings.publicBaseUrl}/abono/${tokenId}?status=approved`;
    const failureUrl = `${paymentSettings.publicBaseUrl}/abono/${tokenId}?status=rejected`;

    const pref = new Preference(mpClient());
    let created: Awaited<ReturnType<typeof pref.create>>;
    try {
      created = await pref.create({
        body: {
          external_reference: tokenId, // ponytail: CUID string → webhook lo distingue de orderId int
          items: [
            {
              id: `consulta-abono-${body.amount}`,
              title: `Abono consulta ${token.serviceName} — ${token.isFonasa ? "FONASA" : "Particular"}`,
              quantity: 1,
              unit_price: amountClp,
              currency_id: "CLP",
            },
          ],
          payer: token.patientEmail ? { email: token.patientEmail } : undefined,
          back_urls: { success: successUrl, failure: failureUrl, pending: successUrl },
          auto_return: "approved",
          // Per-preference webhook URL — takes priority over the dashboard
          // config (MP docs), so abono payments always notify our handler even
          // if the dashboard webhook isn't set. PUBLIC_URL = the api origin.
          ...(process.env.PUBLIC_URL
            ? { notification_url: `${process.env.PUBLIC_URL}/api/mercadopago/webhook` }
            : {}),
          ...(paymentSettings.statementDescriptor
            ? { statement_descriptor: paymentSettings.statementDescriptor }
            : {}),
        },
      });
    } catch (error) {
      await appendAbonoFlowHistory(token.id, "mp_preference_failed", {}, error);
      throw error;
    }

    if (!created.id || !created.init_point) {
      await appendAbonoFlowHistory(token.id, "mp_preference_failed", {
        hasId: Boolean(created.id),
        hasInitPoint: Boolean(created.init_point),
      });
      return c.json({ error: "mp_error" }, 502);
    }

    await appendAbonoFlowHistory(token.id, "mp_preference_created", {
      preferenceId: created.id,
    });
    return c.json({ preference_id: created.id, init_point: created.init_point });
  });
}
