import { db } from "@finanzas/db";
import { decryptSecret } from "../../../lib/secret-cipher.ts";
import { getAccountForPhoneNumber, graphGet, graphPost } from "./_http.ts";

// Meta Commerce catalog products + single-product interactive message.
// Multi-product (MPM) lives in messages.ts. Catalog itself is managed
// outside this app (Meta Business Suite); we only read products and
// send references.

export type CommerceProduct = {
  id: string;
  retailer_id: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
  availability?: string;
};

export async function listCommerceProducts(
  catalogId: string,
  accountId: number,
  search?: string,
  limit = 100,
) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  const token = decryptSecret(account?.systemUserToken);
  if (!token) throw new Error("Account sin token");
  const v = account!.graphApiVersion;
  const qs = new URLSearchParams();
  qs.set(
    "fields",
    "id,retailer_id,name,description,price,currency,image_url,availability",
  );
  qs.set("limit", String(limit));
  if (search) qs.set("filter", JSON.stringify({ name: { i_contains: search } }));
  const data = await graphGet<{ data: CommerceProduct[] }>(
    `/${catalogId}/products?${qs.toString()}`,
    token,
    v,
  );
  return data.data ?? [];
}

export type SendSingleProductInput = {
  phoneNumberId: number;
  toE164: string;
  catalogId: string;
  productRetailerId: string;
  bodyText?: string;
  footerText?: string;
  contextMessageId?: string;
  bizOpaqueCallbackData?: string;
};

export async function sendSingleProductMessage(input: SendSingleProductInput) {
  const phone = await getAccountForPhoneNumber(input.phoneNumberId);
  const v = phone.account.graphApiVersion;
  const token = phone.account.systemUserToken!;
  const interactive: Record<string, unknown> = {
    type: "product",
    ...(input.bodyText ? { body: { text: input.bodyText } } : {}),
    ...(input.footerText ? { footer: { text: input.footerText } } : {}),
    action: {
      catalog_id: input.catalogId,
      product_retailer_id: input.productRetailerId,
    },
  };
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: input.toE164.replace(/^\+/, ""),
    type: "interactive",
    interactive,
  };
  if (input.contextMessageId) payload.context = { message_id: input.contextMessageId };
  if (input.bizOpaqueCallbackData)
    payload.biz_opaque_callback_data = input.bizOpaqueCallbackData;
  return graphPost<{ messages: Array<{ id: string }> }>(
    `/${phone.phoneNumberId}/messages`,
    payload,
    token,
    v,
  );
}
