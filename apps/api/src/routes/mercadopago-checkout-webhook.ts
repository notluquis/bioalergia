// POST /api/mercadopago/webhook
//
// Webhook MP de pagos: topics `payment` + `merchant_order`.
// - Verifica HMAC `x-signature` (raw body irrelevante — manifest = id+request-id+ts).
// - Dedup vía WebhookEvent.
// - Re-fetch desde MP API (NUNCA confiar en body).
// - Sobre APPROVED: marca Order PAID, consume reservas, emite DTE, push stock ML.

import { db } from "@finanzas/db";
import type { Hono } from "hono";
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from "mercadopago";

import { emitDte } from "../modules/haulmer/emit-dte.ts";
import { refetchPayment } from "../modules/mercadopago-checkout/payment.ts";
import { pushStockToMl } from "../modules/mercadolibre/sync.ts";
import { consumeReservations, releaseReservations } from "../modules/reservations/index.ts";
import { sendAbonoConfirmation } from "../services/abono-confirmation.ts";
import { appendAbonoFlowHistory } from "../lib/doctoralia/abono-flow-history.ts";
import { logError } from "../lib/logger.ts";
import { attachDteToOrder, markOrderPaid } from "../services/orders.ts";
export function registerMercadopagoCheckoutWebhook(app: Hono) {
  app.post("/api/mercadopago/webhook", async (c) => {
    const topic = c.req.query("topic") ?? c.req.query("type") ?? "";
    const dataId = c.req.query("data.id") ?? c.req.query("id");

    const sigHeader = c.req.header("x-signature") ?? null;
    const reqId = c.req.header("x-request-id") ?? null;

    // SDK validator: constant-time HMAC + 5-min replay window. Throws on failure.
    let valid = false;
    try {
      WebhookSignatureValidator.validate({
        xSignature: sigHeader,
        xRequestId: reqId,
        dataId: dataId ?? null,
        secret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
        toleranceSeconds: 300,
      });
      valid = true;
    } catch (err) {
      if (err instanceof InvalidWebhookSignatureError) {
        console.warn(
          `[mp-webhook] signature rejected: ${err.reason} (req ${err.requestId ?? "?"})`
        );
      } else {
        throw err;
      }
    }

    // Body para audit log.
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      payload = null;
    }

    // Dedup + audit. If a previous try failed before processedAt, let MP retry process it.
    try {
      await db.webhookEvent.create({
        data: {
          provider: "mercadopago",
          topic,
          externalId: String(dataId ?? ""),
          signatureValid: valid,
          payload: (payload ?? {}) as never,
        },
      });
    } catch {
      const previous = await db.webhookEvent.findFirst({
        where: { provider: "mercadopago", topic, externalId: String(dataId ?? "") },
      });
      if (previous?.processedAt) return c.json({ ok: true, duplicate: true });
      if (!previous) return c.json({ ok: true, duplicate: true });

      await db.webhookEvent.updateMany({
        where: { provider: "mercadopago", topic, externalId: String(dataId ?? "") },
        data: {
          error: null,
          payload: (payload ?? {}) as never,
          signatureValid: valid,
        },
      });
    }

    if (!valid) {
      return c.json({ error: "invalid_signature" }, 401);
    }
    if (!dataId || topic !== "payment") {
      return c.json({ ok: true, ignored: true });
    }

    try {
      const mpPayment = await refetchPayment(dataId);
      const externalRef = mpPayment.external_reference;
      const status = mpPayment.status; // approved | rejected | refunded | ...

      // ¿Es un pago de abono de cita (CUID string) o un pedido de tienda (entero)?
      // ponytail: isNaN("clx...") = true → appointment; isNaN("12345") = false → order
      if (externalRef && isNaN(Number(externalRef))) {
        const token = await db.appointmentPaymentToken.findUnique({
          where: { id: externalRef },
        });
        if (!token) return c.json({ error: "token_not_found" }, 404);

        if (status === "approved" && token.status === "PENDING") {
          await db.appointmentPaymentToken.update({
            where: { id: token.id },
            data: {
              status: "APPROVED",
              mpPaymentId: String(mpPayment.id),
              paidAmountClp: Math.round(Number(mpPayment.transaction_amount ?? 0)),
              paidAt: new Date(),
            },
          });
          await appendAbonoFlowHistory(token.id, "mp_payment_approved", {
            mpPaymentId: String(mpPayment.id),
            paidAmountClp: Math.round(Number(mpPayment.transaction_amount ?? 0)),
          });

          // WA confirmación (best-effort, no rompe el webhook)
          try {
            await sendAbonoConfirmation(token.id);
          } catch (e) {
            await appendAbonoFlowHistory(token.id, "wa_confirmation_failed", {}, e);
            logError("mp-webhook.abono_wa_confirm_failed", e, { tokenId: token.id });
          }
        } else if (
          (status === "rejected" || status === "cancelled") &&
          token.status === "PENDING"
        ) {
          // ponytail: a decline is NOT terminal — keep token PENDING so the
          // patient can retry with another method. Only log the attempt.
          await appendAbonoFlowHistory(token.id, "mp_payment_rejected", { status });
        }

        await db.webhookEvent.updateMany({
          where: { provider: "mercadopago", topic, externalId: String(dataId) },
          data: { processedAt: new Date() },
        });
        return c.json({ ok: true });
      }

      // Flujo de tienda: external_reference es un orderId entero
      const orderId = externalRef ? Number(externalRef) : null;
      if (!orderId) {
        return c.json({ error: "no_external_reference" }, 400);
      }

      // Actualiza Payment + Order
      await db.payment.updateMany({
        where: { orderId },
        data: {
          providerPaymentId: String(mpPayment.id),
          status:
            status === "approved"
              ? "APPROVED"
              : status === "rejected"
                ? "REJECTED"
                : status === "refunded"
                  ? "REFUNDED"
                  : "PENDING",
          rawPayload: mpPayment as never,
          approvedAt: status === "approved" ? new Date() : null,
        },
      });

      if (status === "approved") {
        await markOrderPaid(orderId);
        await consumeReservations(orderId);

        // DTE emission — falla aquí NO debe perder la venta; log y sigue.
        try {
          const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });
          if (order) {
            const dte = await emitDte({
              documentType: order.billingType,
              customerEmail: order.customerEmail,
              customerRut: order.customerRut,
              customerName: order.customerName,
              totalClp: order.totalClp,
              lines: order.items.map((i: (typeof order.items)[number]) => {
                const snap = i.productSnapshot as { sku: string; name: string };
                return {
                  sku: snap.sku,
                  name: snap.name,
                  qty: i.qty,
                  unitPriceClp: i.unitPriceClp,
                };
              }),
            });
            await attachDteToOrder(orderId, dte);
          }
        } catch (e) {
          console.error("[mp-webhook] DTE emit failed", e);
        }

        // Push stock a ML (best-effort).
        try {
          const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });
          if (order) {
            for (const it of order.items) {
              await pushStockToMl(it.productId).catch(() => undefined);
            }
          }
        } catch (e) {
          console.error("[mp-webhook] ML stock push failed", e);
        }
      } else if (status === "rejected" || status === "cancelled") {
        await releaseReservations(orderId);
      }

      await db.webhookEvent.updateMany({
        where: {
          provider: "mercadopago",
          topic,
          externalId: String(dataId),
        },
        data: { processedAt: new Date() },
      });

      return c.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.webhookEvent.updateMany({
        where: {
          provider: "mercadopago",
          topic,
          externalId: String(dataId),
        },
        data: { error: msg },
      });
      console.error("[mp-webhook] error", e);
      return c.json({ error: msg }, 500);
    }
  });
}
