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
import {
  consumeReservations,
  releaseReservations,
  reserveStockForOrder,
} from "../modules/reservations/index.ts";
import { sendAbonoConfirmation } from "../services/abono-confirmation.ts";
import { sendOrderConfirmationEmail } from "../services/email/transactional.ts";
import { appendAbonoFlowHistory } from "../lib/doctoralia/abono-flow-history.ts";
import { logError } from "../lib/logger.ts";
import { attachDteToOrder, markOrderPaid } from "../services/orders.ts";
export function registerMercadopagoCheckoutWebhook(app: Hono) {
  app.post("/api/mercadopago/webhook", async (c) => {
    const topic = c.req.query("topic") ?? c.req.query("type") ?? "";
    const dataId = c.req.query("data.id") ?? c.req.query("id");

    const sigHeader = c.req.header("x-signature") ?? null;
    const reqId = c.req.header("x-request-id") ?? null;

    // Validate HMAC only for `payment` — the only topic we act on. Legacy
    // merchant_order/IPN deliveries carry no valid x-signature, so validating
    // them is pure log noise. Timestamp replay window disabled (100y): MP's own
    // retries reuse the original ts; replay is neutralised by the dedup +
    // terminal-status processedAt guard below. HMAC stays mandatory for payment.
    let valid = false;
    if (topic === "payment") {
      try {
        WebhookSignatureValidator.validate({
          xSignature: sigHeader,
          xRequestId: reqId,
          dataId: dataId ?? null,
          secret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
          toleranceSeconds: 3_153_600_000,
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
    }

    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      payload = null;
    }

    // Persist EVERY delivery (full audit log — all topics incl. merchant_order
    // + test). Dedup on (provider, topic, externalId): retries refresh the row.
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

    // Stored. Now filter to the only topic we act on.
    if (topic !== "payment") {
      return c.json({ ok: true, ignored: true });
    }
    if (!valid) {
      return c.json({ error: "invalid_signature" }, 401);
    }
    if (!dataId) {
      return c.json({ ok: true, ignored: true });
    }
    // Test/simulator (live_mode:false) carry a fake id that 404s on refetch.
    // Already logged above; ack so MP's tester doesn't 500-retry-storm.
    if (
      payload &&
      typeof payload === "object" &&
      (payload as { live_mode?: boolean }).live_mode === false
    ) {
      return c.json({ ok: true, test: true });
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
        } else if (status === "refunded" || status === "charged_back") {
          // Refund/chargeback after approval — log for visibility (no REFUNDED
          // token state today; surfaced in flow_history so staff can act).
          await appendAbonoFlowHistory(token.id, "mp_payment_refunded", { status });
        } else if (token.status === "PENDING") {
          // in_process / pending / authorized — MP is still settling. Log it
          // (visible in flow_history) but do NOT mark the event processed below,
          // so the later `approved` webhook (same payment id) isn't deduped
          // before it lands. THIS is what lets deferred payments confirm.
          await appendAbonoFlowHistory(token.id, "mp_payment_pending", { status });
        }

        // Mark processed ONLY on a terminal status. An in_process→approved
        // sequence shares one payment id; if in_process set processedAt, the
        // approval would be deduped and never confirm.
        if (
          status === "approved" ||
          status === "rejected" ||
          status === "cancelled" ||
          status === "refunded" ||
          status === "charged_back"
        ) {
          await db.webhookEvent.updateMany({
            where: { provider: "mercadopago", topic, externalId: String(dataId) },
            data: { processedAt: new Date() },
          });
        }
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

      // Idempotency: MP can deliver several distinct `approved` notifications for
      // the same payment. WebhookEvent dedup only catches identical ids, so guard
      // on the order itself — if it's already paid, skip re-reserve/DTE/ML (a
      // second re-reserve would double-decrement stock).
      const alreadyPaid =
        status === "approved" &&
        (await db.order.findUnique({ where: { id: orderId }, select: { status: true } }))
          ?.status !== "PENDING";

      if (status === "approved" && !alreadyPaid) {
        // Checkout Pro is async — the buyer may approve after the 15-min
        // reservation expired (or after a rejected attempt that freed stock). If
        // the order has no ACTIVE reservation, re-acquire stock before marking
        // paid; if it's truly gone, still mark paid (money is captured) but flag
        // for manual fulfillment instead of silently overselling.
        const activeReservations = await db.stockReservation.count({
          where: { orderId, status: "ACTIVE" },
        });
        let stockSecured = activeReservations > 0;
        if (!stockSecured) {
          const reorder = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });
          if (reorder) {
            try {
              await reserveStockForOrder({
                orderId,
                items: reorder.items.map((i: (typeof reorder.items)[number]) => ({
                  productId: i.productId,
                  qty: i.qty,
                })),
              });
              stockSecured = true;
            } catch {
              stockSecured = false;
            }
          }
        }

        await markOrderPaid(orderId);
        await consumeReservations(orderId);

        if (!stockSecured) {
          logError(
            "mp-webhook.oversell",
            new Error(`Order ${orderId} paid but stock unavailable — needs manual fulfillment`),
            { orderId }
          );
        }

        // DTE emission — falla aquí NO debe perder la venta; log y sigue.
        let dtePdfUrl: string | undefined;
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
            dtePdfUrl = dte.pdfUrl;
            await attachDteToOrder(orderId, dte);
          }
        } catch (e) {
          console.error("[mp-webhook] DTE emit failed", e);
        }

        // Order confirmation email to the buyer (best-effort — never break the
        // webhook). Sent after DTE so the boleta/factura folio + PDF can ride
        // along; sends regardless of whether DTE succeeded.
        try {
          const order = await db.order.findUnique({
            where: { id: orderId },
            include: { items: true },
          });
          if (order) {
            await sendOrderConfirmationEmail({
              to: order.customerEmail,
              orderNumber: order.number,
              totalClp: order.totalClp,
              items: order.items.map((i: (typeof order.items)[number]) => {
                const snap = i.productSnapshot as { name: string };
                return { name: snap.name, qty: i.qty, unitPriceClp: i.unitPriceClp };
              }),
              billingType: order.billingType,
              ...(order.dteFolio ? { dteFolio: order.dteFolio } : {}),
              ...(dtePdfUrl ? { dtePdfUrl } : {}),
            });
          }
        } catch (e) {
          logError("mp-webhook.order_confirmation_email_failed", e, { orderId });
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
      } else if (status === "cancelled") {
        // Only a terminal cancel frees stock. A `rejected` attempt is retryable on
        // the hosted checkout, so keep the reservation (the TTL sweep frees it if
        // the buyer abandons) — releasing here would let an eventual retry-approval
        // oversell.
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
