// MercadoPago Checkout Pro (golden 2026).
//
// Flow:
//   1. /api/orpc/checkout/start creates a PENDING order, then a MP Preference
//      (`createCheckoutPreference`) and returns its `init_point`.
//   2. The storefront redirects the buyer to that hosted checkout, which offers
//      every method (cards, MP balance, Webpay, installments) — PCI on MP.
//   3. The webhook (payment notification, `refetchPayment`) lands later with the
//      authoritative status and maps back via `external_reference = orderId`.

import { MercadoPagoConfig, Payment, PaymentRefund, Preference } from "mercadopago";

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

export type CheckoutPreferenceInput = {
  orderId: number;
  orderNumber: string;
  customerEmail: string;
  accessToken?: string | null;
  shippingClp: number;
  items: Array<{ sku: string; title: string; qty: number; unitPriceClp: number }>;
};

/**
 * Checkout Pro — create a preference and return its `init_point` (MP-hosted
 * checkout that offers every method: cards, MP balance, Webpay, installments).
 * The order is created PENDING first; `external_reference = orderId` lets the
 * shared webhook confirm it. Shipping is added as an extra line item.
 */
export async function createCheckoutPreference(
  input: CheckoutPreferenceInput
): Promise<{ preferenceId: string; initPoint: string }> {
  // Token-based status link (no email/PII in the URL); fall back to email.
  const backUrl = input.accessToken
    ? `${getStoreUrl()}/pedido/${input.orderNumber}?token=${encodeURIComponent(input.accessToken)}`
    : `${getStoreUrl()}/pedido/${input.orderNumber}?email=${encodeURIComponent(input.customerEmail)}`;
  const items = input.items.map((it) => ({
    id: it.sku,
    title: it.title,
    quantity: it.qty,
    unit_price: it.unitPriceClp,
    currency_id: "CLP",
  }));
  if (input.shippingClp > 0) {
    items.push({
      id: "envio",
      title: "Envío Chilexpress",
      quantity: 1,
      unit_price: input.shippingClp,
      currency_id: "CLP",
    });
  }

  const pref = new Preference(client());
  const created = await pref.create({
    body: {
      external_reference: String(input.orderId),
      items,
      payer: { email: input.customerEmail },
      back_urls: { success: backUrl, failure: backUrl, pending: backUrl },
      auto_return: "approved",
      statement_descriptor: "BIOALERGIA",
    },
  });

  if (!created.id || !created.init_point) {
    throw new Error("[mp-checkout] preference sin init_point");
  }
  return { preferenceId: created.id, initPoint: created.init_point };
}

export async function refetchPayment(paymentId: string | number) {
  const payment = new Payment(client());
  return await payment.get({ id: String(paymentId) });
}

/** Full refund of an approved payment. `paymentId` is the MP payment id stored
 *  as `providerPaymentId` after approval. */
export async function refundPayment(paymentId: string): Promise<void> {
  const refund = new PaymentRefund(client());
  await refund.create({ payment_id: Number(paymentId) });
}

// Webhook signature verification moved to MercadoPago SDK's
// `WebhookSignatureValidator` (adds replay-window + version forward-compat).
// See routes/mercadopago-checkout-webhook.ts.
