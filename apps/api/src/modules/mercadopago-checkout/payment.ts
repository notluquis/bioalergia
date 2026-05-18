// MercadoPago Checkout — Preference API (para Payment Brick).
// La cuenta MP es la misma que la usada en reconciliation; reuso
// MP_ACCESS_TOKEN existente (Lucas confirmó 2026-05-17).

import { MercadoPagoConfig, Preference, Payment } from "mercadopago";
import { createHmac, randomUUID } from "node:crypto";

function getAccessToken(): string {
  const token =
    process.env.MP_ACCESS_TOKEN ??
    process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("[mp-checkout] MP_ACCESS_TOKEN no configurado");
  return token;
}

function getStoreUrl(): string {
  return (
    process.env.STOREFRONT_BASE_URL ?? "https://bioalergia.cl"
  ).replace(/\/+$/, "");
}

function client(): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken: getAccessToken(),
    options: { timeout: 8000 },
  });
}

export type CheckoutPreferenceInput = {
  orderNumber: string;
  orderId: number;
  customerEmail: string;
  items: Array<{
    sku: string;
    title: string;
    qty: number;
    unitPriceClp: number;
  }>;
};

export type CheckoutPreferenceResult = {
  preferenceId: string;
  initPoint: string;
  idempotencyKey: string;
};

export async function createCheckoutPreference(
  input: CheckoutPreferenceInput
): Promise<CheckoutPreferenceResult> {
  const idempotencyKey = randomUUID();
  const storeUrl = getStoreUrl();
  const pref = new Preference(client());

  const created = await pref.create({
    body: {
      items: input.items.map((it) => ({
        id: it.sku,
        title: it.title,
        quantity: it.qty,
        unit_price: it.unitPriceClp,
        currency_id: "CLP",
      })),
      external_reference: String(input.orderId),
      payer: { email: input.customerEmail },
      back_urls: {
        success: `${storeUrl}/checkout/exito?order=${input.orderNumber}`,
        failure: `${storeUrl}/checkout/fallo?order=${input.orderNumber}`,
        pending: `${storeUrl}/checkout/pendiente?order=${input.orderNumber}`,
      },
      auto_return: "approved",
      notification_url: `${storeUrl.replace("https://", "https://api.")}/api/mercadopago/webhook`,
      statement_descriptor: "BIOALERGIA",
    },
    requestOptions: { idempotencyKey },
  });

  if (!created.id) throw new Error("[mp-checkout] preferencia sin id");
  return {
    preferenceId: created.id,
    initPoint: created.init_point ?? created.sandbox_init_point ?? "",
    idempotencyKey,
  };
}

export async function refetchPayment(paymentId: string | number) {
  const payment = new Payment(client());
  return await payment.get({ id: String(paymentId) });
}

// Webhook signature verification:
// MP envía header `x-signature` con `ts=<>,v1=<HMAC_SHA256>`.
// Manifest: id:<dataId>;request-id:<reqId>;ts:<ts>; (concat)
// Signed con MERCADOPAGO_WEBHOOK_SECRET.
//
// Ref: https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks
export function verifyMpWebhookSignature(opts: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret?: string;
}): boolean {
  const secret = opts.secret ?? process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !opts.signatureHeader || !opts.dataId) return false;

  const parts = opts.signatureHeader.split(",").reduce<Record<string, string>>(
    (acc, kv) => {
      const [k, v] = kv.split("=").map((s) => s.trim());
      if (k && v) acc[k] = v;
      return acc;
    },
    {}
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${opts.dataId};request-id:${opts.requestId ?? ""};ts:${ts};`;
  const computed = createHmac("sha256", secret).update(manifest).digest("hex");
  if (computed.length !== v1.length) return false;
  // timingSafeEqual via Buffer
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}
