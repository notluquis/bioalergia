// POST /api/mercadopago/webhook
//
// Webhook MP de pagos: topics `payment` + `merchant_order`.
// - Verifica HMAC `x-signature` (raw body irrelevante — manifest = id+request-id+ts).
// - Dedup vía WebhookEvent.
// - Re-fetch desde MP API (NUNCA confiar en body).
// - Sobre APPROVED: marca Order PAID, consume reservas, emite DTE, push stock ML.

import { db } from "@finanzas/db";
import type { Hono } from "hono";

import { emitDte } from "../modules/haulmer/emit-dte.ts";
import {
  refetchPayment,
  verifyMpWebhookSignature,
} from "../modules/mercadopago-checkout/payment.ts";
import { pushStockToMl } from "../modules/mercadolibre/sync.ts";
import { consumeReservations, releaseReservations } from "../modules/reservations/index.ts";
import { attachDteToOrder, markOrderPaid } from "../services/orders.ts";

export function registerMercadopagoCheckoutWebhook(app: Hono) {
  app.post("/api/mercadopago/webhook", async (c) => {
    const topic = c.req.query("topic") ?? c.req.query("type") ?? "";
    const dataId = c.req.query("data.id") ?? c.req.query("id");

    const sigHeader = c.req.header("x-signature") ?? null;
    const reqId = c.req.header("x-request-id") ?? null;

    const valid = verifyMpWebhookSignature({
      signatureHeader: sigHeader,
      requestId: reqId,
      dataId: dataId ?? null,
    });

    // Body para audit log.
    let payload: unknown;
    try {
      payload = await c.req.json();
    } catch {
      payload = null;
    }

    // Dedup + audit.
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
      // Unique constraint hit → ya procesado.
      return c.json({ ok: true, duplicate: true });
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
      const orderId = externalRef ? Number(externalRef) : null;
      if (!orderId) {
        return c.json({ error: "no_external_reference" }, 400);
      }
      const status = mpPayment.status; // approved | rejected | refunded | ...

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
              lines: order.items.map((i) => {
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
