// POST /api/webhooks/mercadolibre
//
// Webhook MercadoLibre — topics que recibimos:
//   - orders_v2  → fetch /orders/{id}, materializa Order local (channel=MERCADO_LIBRE),
//                  emite DTE boleta, push stock.
//   - items      → sync MlListing.status + permalink desde el item upstream.
//   - questions  → log + persist en WebhookEvent (defer respuesta).
//   - claims     → log + persist (defer resolución).
//
// ML NO firma webhooks; en vez de HMAC validamos `application_id` contra ML_CLIENT_ID.
// Dedupe via @@unique([provider, topic, externalId]) en WebhookEvent.
// Siempre 200 OK; errores se persisten en WebhookEvent.error y ML reintenta.

import { db } from "@finanzas/db";
import type { Hono } from "hono";

import { emitDte } from "../modules/haulmer/emit-dte.ts";
import { getMlOrder, mlRequest, pushStockToMl } from "../modules/mercadolibre/sync.ts";
import { attachDteToOrder } from "../services/orders.ts";

const PROVIDER = "mercadolibre" as const;

type MlWebhookBody = {
  resource?: string;
  user_id?: number;
  topic?: string;
  application_id?: number | string;
  attempts?: number;
  sent?: string;
  received?: string;
  _id?: string;
};

function generateMlOrderNumber(mlOrderId: string): string {
  const year = new Date().getFullYear();
  return `ML-${year}-${mlOrderId}`;
}

function extractIdFromResource(resource: string): string {
  // e.g. "/orders/123456" → "123456"; "/items/MLC123" → "MLC123"
  const idx = resource.lastIndexOf("/");
  return idx >= 0 ? resource.slice(idx + 1) : resource;
}

type MlItemUpstream = {
  id: string;
  status: string;
  permalink?: string;
};

async function handleOrdersV2(orderId: string): Promise<void> {
  // Si ya tenemos la orden persistida → idempotente.
  const existing = await db.order.findUnique({ where: { mlOrderId: orderId } });
  if (existing) {
    return;
  }

  const mlOrder = await getMlOrder(orderId);

  // Lookup productos locales por seller_sku.
  type LineInput = {
    productId: number;
    qty: number;
    unitPriceClp: number;
    productSnapshot: { sku: string; name: string };
  };

  const lines: LineInput[] = [];
  for (const item of mlOrder.order_items) {
    const sku = item.item.seller_sku;
    if (!sku) {
      throw new Error(`ML order ${orderId} item ${item.item.id} sin seller_sku`);
    }
    const product = await db.product.findUnique({ where: { sku } });
    if (!product) {
      throw new Error(`ML order ${orderId}: producto con SKU ${sku} no existe localmente`);
    }
    lines.push({
      productId: product.id,
      qty: item.quantity,
      unitPriceClp: Math.round(item.unit_price),
      productSnapshot: { sku: product.sku, name: product.name },
    });
  }

  const subtotal = lines.reduce((acc, l) => acc + l.unitPriceClp * l.qty, 0);
  const total = Math.round(mlOrder.total_amount);

  const customerName =
    [mlOrder.buyer.first_name, mlOrder.buyer.last_name].filter(Boolean).join(" ").trim() ||
    mlOrder.buyer.nickname;
  const customerEmail = mlOrder.buyer.email ?? `ml-${mlOrder.buyer.id}@mercadolibre.invalid`;

  const created = await db.order.create({
    data: {
      number: generateMlOrderNumber(orderId),
      customerEmail,
      customerName,
      billingType: "BOLETA",
      subtotalClp: subtotal,
      shippingClp: Math.max(0, total - subtotal),
      discountClp: 0,
      totalClp: total,
      status: "PAID",
      channel: "MERCADO_LIBRE",
      mlOrderId: orderId,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          qty: l.qty,
          unitPriceClp: l.unitPriceClp,
          lineTotalClp: l.unitPriceClp * l.qty,
          productSnapshot: l.productSnapshot as never,
        })),
      },
    },
    include: { items: true },
  });

  // Emite boleta (best-effort: si falla, no perdemos la venta).
  try {
    const dte = await emitDte({
      documentType: "BOLETA",
      customerEmail: created.customerEmail,
      customerName: created.customerName,
      totalClp: created.totalClp,
      lines: created.items.map((i: (typeof created.items)[number]) => {
        const snap = i.productSnapshot as { sku: string; name: string };
        return {
          sku: snap.sku,
          name: snap.name,
          qty: i.qty,
          unitPriceClp: i.unitPriceClp,
        };
      }),
    });
    await attachDteToOrder(created.id, dte);
  } catch (e) {
    console.error("[ml-webhook] DTE emit failed", e);
  }

  // Push stock actualizado a ML por cada producto (best-effort).
  for (const l of lines) {
    await pushStockToMl(l.productId).catch((e: unknown) => {
      console.error("[ml-webhook] pushStockToMl failed", l.productId, e);
    });
  }
}

async function handleItems(mlItemId: string): Promise<void> {
  const item = await mlRequest<MlItemUpstream>({ path: `/items/${mlItemId}` });
  const listing = await db.mlListing.findUnique({ where: { mlItemId } });
  if (!listing) return; // ítem no tracked → ignorar

  const statusMap: Record<string, "ACTIVE" | "PAUSED" | "CLOSED" | "DRAFT"> = {
    active: "ACTIVE",
    paused: "PAUSED",
    closed: "CLOSED",
    under_review: "DRAFT",
  };
  const nextStatus = statusMap[item.status] ?? "DRAFT";

  await db.mlListing.update({
    where: { mlItemId },
    data: {
      status: nextStatus,
      ...(item.permalink ? { permalink: item.permalink } : {}),
      lastSyncAt: new Date(),
    },
  });
}

export function registerMercadolibreWebhook(app: Hono) {
  app.post("/api/webhooks/mercadolibre", async (c) => {
    let body: MlWebhookBody = {};
    try {
      body = (await c.req.json()) as MlWebhookBody;
    } catch {
      // body vacío o no-JSON: respondemos 200 igual para no encolar reintentos
      return c.json({ ok: true, ignored: "no_body" });
    }

    const topic = String(body.topic ?? "");
    const resource = String(body.resource ?? "");
    const expectedAppId = process.env.ML_CLIENT_ID;
    const appIdOk = expectedAppId ? String(body.application_id) === expectedAppId : false;

    const externalId = `${topic}:${resource}`;

    // Dedup + audit.
    try {
      await db.webhookEvent.create({
        data: {
          provider: PROVIDER,
          topic,
          externalId,
          signatureValid: appIdOk,
          payload: (body ?? {}) as never,
        },
      });
    } catch {
      // unique constraint hit → ya procesado.
      return c.json({ ok: true, duplicate: true });
    }

    if (!appIdOk) {
      // Persistimos para auditoría pero no procesamos.
      return c.json({ ok: true, ignored: "invalid_application_id" });
    }

    try {
      if (topic === "orders_v2" || topic === "orders") {
        const id = extractIdFromResource(resource);
        if (id) await handleOrdersV2(id);
      } else if (topic === "items") {
        const id = extractIdFromResource(resource);
        if (id) await handleItems(id);
      } else if (topic === "questions" || topic === "claims") {
        // Defer: solo persistimos para audit; resolución manual por ahora.
      }

      await db.webhookEvent.updateMany({
        where: { provider: PROVIDER, topic, externalId },
        data: { processedAt: new Date() },
      });

      return c.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.webhookEvent.updateMany({
        where: { provider: PROVIDER, topic, externalId },
        data: { error: msg },
      });
      console.error("[ml-webhook] error", topic, resource, e);
      // Igual 200 — ML reintenta 3 veces; pero al devolver 200 evitamos thundering retries
      // mientras debugueamos. Cambiar a 500 si queremos forzar reintentos.
      return c.json({ ok: false, error: msg });
    }
  });
}
