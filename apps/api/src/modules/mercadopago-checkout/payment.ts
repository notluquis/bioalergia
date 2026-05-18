// MercadoPago Checkout — Orders API + Payment Brick (golden 2026).
//
// Flow:
//   1. Brick on the storefront tokenizes the card client-side and
//      submits { token, payment_method_id, installments, payer } to
//      our /api/orpc/checkout/start endpoint.
//   2. We POST /v1/orders with `type=online`,
//      `processing_mode=automatic`, `transactions.payments=[…]`
//      via mercadopago SDK v2 Order client.
//   3. MP returns an order_id; webhook (payment.updated / order)
//      lands later with the authoritative status.
//
// `/v1/orders` replaces both `/checkout/preferences` (Checkout Pro)
// and `/v1/payments` (legacy direct), per MP's 2026 unified API.

import { MercadoPagoConfig, Order, Payment } from "mercadopago";
import { createHmac, randomUUID } from "node:crypto";

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN ?? process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("[mp-checkout] MP_ACCESS_TOKEN no configurado");
  return token;
}

function getStoreUrl(): string {
  return (process.env.STOREFRONT_BASE_URL ?? "https://bioalergia.cl").replace(/\/+$/, "");
}

function client(): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 8000 },
  });
}

export type BrickSubmission = {
  token: string;
  payment_method_id: string;
  issuer_id?: string;
  installments: number;
  payer: {
    email: string;
    identification?: { type: string; number: string } | undefined;
  };
};

export type CreateCheckoutOrderInput = {
  orderId: number;
  orderNumber: string;
  amountClp: number;
  brick: BrickSubmission;
  items: Array<{
    sku: string;
    title: string;
    description?: string | undefined;
    qty: number;
    unitPriceClp: number;
  }>;
  payer: {
    email: string;
    firstName?: string | undefined;
    lastName?: string | undefined;
    rut?: string | undefined;
  };
};

export type CreateCheckoutOrderResult = {
  orderId: string;
  status: string;
  statusDetail: string;
  idempotencyKey: string;
};

export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput
): Promise<CreateCheckoutOrderResult> {
  const idempotencyKey = randomUUID();
  const order = new Order(client());

  const created = await order.create({
    body: {
      type: "online",
      processing_mode: "automatic",
      external_reference: String(input.orderId),
      description: `Orden ${input.orderNumber} — Bioalergia`,
      total_amount: String(input.amountClp),
      capture_mode: "automatic_async",
      payer: {
        email: input.payer.email,
        ...(input.payer.firstName && { first_name: input.payer.firstName }),
        ...(input.payer.lastName && { last_name: input.payer.lastName }),
        ...(input.payer.rut && {
          identification: { type: "RUT", number: input.payer.rut.replace(/[.-]/g, "") },
        }),
      },
      transactions: {
        payments: [
          {
            amount: String(input.amountClp),
            payment_method: {
              id: input.brick.payment_method_id,
              type: "credit_card",
              token: input.brick.token,
              installments: input.brick.installments,
              statement_descriptor: "BIOALERGIA",
            },
          },
        ],
      },
      items: input.items.map((it) => ({
        title: it.title,
        unit_price: String(it.unitPriceClp),
        quantity: it.qty,
        ...(it.description && { description: it.description }),
        external_code: it.sku,
        type: "good",
      })),
      additional_info: {
        ip_address: undefined,
        items: input.items.map((it) => ({
          id: it.sku,
          title: it.title,
          quantity: it.qty,
          unit_price: String(it.unitPriceClp),
        })),
      },
    },
    requestOptions: { idempotencyKey },
  });

  if (!created.id) throw new Error("[mp-checkout] order sin id");
  return {
    orderId: created.id,
    status: created.status ?? "pending",
    statusDetail: created.status_detail ?? "",
    idempotencyKey,
  };
}

export async function getCheckoutOrder(orderId: string) {
  const order = new Order(client());
  return await order.get({ id: orderId });
}

export async function refetchPayment(paymentId: string | number) {
  const payment = new Payment(client());
  return await payment.get({ id: String(paymentId) });
}

// Storefront URL (back_urls) for legacy Brick wallet flows that still
// redirect — Payment Brick "card" path keeps user on-site.
export function getStorefrontReturnUrls(orderNumber: string) {
  const base = getStoreUrl();
  return {
    success: `${base}/checkout/exito?order=${orderNumber}`,
    failure: `${base}/checkout/fallo?order=${orderNumber}`,
    pending: `${base}/checkout/pendiente?order=${orderNumber}`,
  };
}

// Webhook signature verification — MP sends `x-signature` header with
// `ts=<>,v1=<HMAC_SHA256>`. Manifest = `id:<dataId>;request-id:<reqId>;ts:<ts>;`
// signed with MERCADOPAGO_WEBHOOK_SECRET. Constant-time compare.
// Ref: https://www.mercadopago.cl/developers/en/docs/your-integrations/notifications/webhooks
export function verifyMpWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret?: string;
}): boolean {
  const secret = opts.secret ?? process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !opts.signatureHeader || !opts.dataId) return false;

  const parts = opts.signatureHeader
    .split(",")
    .reduce<Record<string, string>>((acc, kv) => {
      const [k, v] = kv.split("=").map((s) => s.trim());
      if (k && v) acc[k] = v;
      return acc;
    }, {});
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${opts.dataId};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");
  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}
