// Lógica de cuentas / teléfonos / commerce de WhatsApp Cloud, fuera de los
// handlers oRPC (golden 2026: handlers finos). Validan, hacen queries y lanzan
// DomainError (mapeado a HTTP por orpc/error.ts::toORPCError). El cifrado de
// secretos at-rest (encryptSecret) y las llamadas al Graph client de Meta
// (listAccountPhoneNumbers/listAccountTemplates/listCommerceProducts/
// sendSingleProductMessage/sendMultiProductMessage) se conservan intactas.

import { db } from "@finanzas/db";
import type {
  accountResponseSchema,
  embeddedSignupInputSchema,
  listAccountsResponseSchema,
  listCommerceProductsInputSchema,
  listCommerceProductsResponseSchema,
  sendMessageResponseSchema,
  sendMultiProductInputSchema,
  sendSingleProductInputSchema,
  setCommerceCatalogInputSchema,
  syncTemplatesResponseSchema,
  upsertAccountInputSchema,
  upsertPhoneNumberInputSchema,
  validateAccountResponseSchema,
} from "@finanzas/orpc-contracts/wa-cloud";
import type { z } from "zod";
import { DomainError } from "../lib/errors.ts";
import { encryptSecret } from "../lib/secret-cipher.ts";
import {
  listAccountPhoneNumbers,
  listAccountTemplates,
  listCommerceProducts,
  sendMultiProductMessage,
  sendSingleProductMessage,
} from "../modules/wa-cloud/graph-client.ts";

const WINDOW_HOURS = 24;

type ListAccountsResponse = z.infer<typeof listAccountsResponseSchema>;
type AccountResponse = z.infer<typeof accountResponseSchema>;
type UpsertAccountPayload = z.infer<typeof upsertAccountInputSchema>;
type UpsertPhoneNumberPayload = z.infer<typeof upsertPhoneNumberInputSchema>;
type ValidateAccountResponse = z.infer<typeof validateAccountResponseSchema>;
type SyncTemplatesResponse = z.infer<typeof syncTemplatesResponseSchema>;
type EmbeddedSignupPayload = z.infer<typeof embeddedSignupInputSchema>;
type SetCommerceCatalogPayload = z.infer<typeof setCommerceCatalogInputSchema>;
type ListCommerceProductsPayload = z.infer<typeof listCommerceProductsInputSchema>;
type ListCommerceProductsResponse = z.infer<typeof listCommerceProductsResponseSchema>;
type SendSingleProductPayload = z.infer<typeof sendSingleProductInputSchema>;
type SendMultiProductPayload = z.infer<typeof sendMultiProductInputSchema>;
type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

function windowOpen(lastInbound: Date | null): boolean {
  return lastInbound ? Date.now() - lastInbound.getTime() < WINDOW_HOURS * 60 * 60 * 1000 : false;
}

export function maskAccount(a: {
  id: number;
  wabaId: string;
  metaBusinessId: string | null;
  appId: string | null;
  graphApiVersion: string;
  displayName: string | null;
  active: boolean;
  systemUserToken: string | null;
  appSecret: string | null;
  webhookVerifyToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: a.id,
    wabaId: a.wabaId,
    metaBusinessId: a.metaBusinessId,
    appId: a.appId,
    graphApiVersion: a.graphApiVersion,
    displayName: a.displayName,
    active: a.active,
    hasToken: Boolean(a.systemUserToken),
    hasAppSecret: Boolean(a.appSecret),
    hasVerifyToken: Boolean(a.webhookVerifyToken),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

async function buildAccountWithPhones(id: number): Promise<AccountResponse["account"]> {
  const acc = await db.waBusinessAccount.findUnique({
    where: { id },
    include: { phoneNumbers: true },
  });
  if (!acc) throw new DomainError("NOT_FOUND", "Account no encontrada");
  return {
    ...maskAccount(acc),
    phoneNumbers: acc.phoneNumbers,
  } as unknown as AccountResponse["account"];
}

export async function listAccounts(): Promise<ListAccountsResponse> {
  const accs = await db.waBusinessAccount.findMany({
    include: { phoneNumbers: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    accounts: accs.map((a: (typeof accs)[number]) => ({
      ...maskAccount(a),
      phoneNumbers: a.phoneNumbers,
    })),
  } as unknown as ListAccountsResponse;
}

export async function upsertAccount(payload: UpsertAccountPayload): Promise<AccountResponse> {
  // All three secrets are encrypted at rest (AES-256-GCM, prefix
  // `enc:v1:`). Plaintext input from the operator is encrypted here
  // before any DB write.
  const encOrUndef = (v: string | undefined) =>
    v === undefined ? undefined : v ? encryptSecret(v) : null;
  const data = {
    wabaId: payload.wabaId,
    metaBusinessId: payload.metaBusinessId ?? null,
    appId: payload.appId ?? null,
    appSecret: payload.appSecret ? encryptSecret(payload.appSecret) : undefined,
    systemUserToken: payload.systemUserToken ? encryptSecret(payload.systemUserToken) : undefined,
    webhookVerifyToken: payload.webhookVerifyToken
      ? encryptSecret(payload.webhookVerifyToken)
      : undefined,
    graphApiVersion: payload.graphApiVersion ?? "v21.0",
    displayName: payload.displayName ?? null,
    active: payload.active ?? true,
  };
  const acc = payload.id
    ? await db.waBusinessAccount.update({
        where: { id: payload.id },
        data: {
          ...data,
          ...(payload.appSecret !== undefined ? { appSecret: encOrUndef(payload.appSecret) } : {}),
          ...(payload.systemUserToken !== undefined
            ? { systemUserToken: encOrUndef(payload.systemUserToken) }
            : {}),
          ...(payload.webhookVerifyToken !== undefined
            ? { webhookVerifyToken: encOrUndef(payload.webhookVerifyToken) }
            : {}),
        },
      })
    : await db.waBusinessAccount.create({ data });
  return { account: await buildAccountWithPhones(acc.id) };
}

export async function deleteAccount(id: number): Promise<void> {
  await db.waBusinessAccount.delete({ where: { id } });
}

export async function validateAccount(id: number): Promise<ValidateAccountResponse> {
  try {
    const phones = await listAccountPhoneNumbers(id);
    const tpl = await listAccountTemplates(id);
    return {
      ok: true,
      phoneNumbersFound: phones.length,
      templatesFound: tpl.length,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      phoneNumbersFound: 0,
      templatesFound: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function syncPhoneNumbers(id: number): Promise<AccountResponse> {
  const phones = await listAccountPhoneNumbers(id);
  // Batch existing rows once instead of N findUnique queries.
  const existingRows = await db.waPhoneNumber.findMany({
    where: { phoneNumberId: { in: phones.map((p) => p.id) } },
  });
  const existingByMetaId = new Map(
    existingRows.map((r: (typeof existingRows)[number]) => [r.phoneNumberId, r])
  );
  await Promise.all(
    phones.map((p) => {
      const existing = existingByMetaId.get(p.id);
      const data = {
        accountId: id,
        phoneNumberId: p.id,
        displayPhoneNumber: p.display_phone_number,
        label: existing?.label ?? p.verified_name ?? null,
        qualityRating: p.quality_rating ?? null,
        active: true,
      };
      return existing
        ? db.waPhoneNumber.update({ where: { id: existing.id }, data })
        : db.waPhoneNumber.create({ data });
    })
  );
  return { account: await buildAccountWithPhones(id) };
}

export async function upsertPhoneNumber(
  payload: UpsertPhoneNumberPayload
): Promise<AccountResponse> {
  const data = {
    accountId: payload.accountId,
    phoneNumberId: payload.phoneNumberId,
    displayPhoneNumber: payload.displayPhoneNumber,
    label: payload.label ?? null,
    active: payload.active ?? true,
  };
  if (payload.id) {
    await db.waPhoneNumber.update({ where: { id: payload.id }, data });
  } else {
    await db.waPhoneNumber.create({ data });
  }
  return { account: await buildAccountWithPhones(payload.accountId) };
}

export async function embeddedSignupComplete(
  payload: EmbeddedSignupPayload
): Promise<AccountResponse> {
  // Upsert WaBusinessAccount by wabaId, encrypting the system-user
  // token at rest. Reuses the same encryption path as the manual
  // upsert handler so rotation tooling covers it automatically.
  const existing = await db.waBusinessAccount.findUnique({
    where: { wabaId: payload.wabaId },
  });
  const data = {
    wabaId: payload.wabaId,
    metaBusinessId: payload.metaBusinessId ?? null,
    appId: payload.appId ?? null,
    systemUserToken: encryptSecret(payload.systemUserToken),
    graphApiVersion: "v21.0",
    displayName: payload.displayName ?? null,
    active: true,
  };
  const acc = existing
    ? await db.waBusinessAccount.update({ where: { id: existing.id }, data })
    : await db.waBusinessAccount.create({ data });
  // Upsert the phone row by Meta phoneNumberId.
  const phoneExisting = await db.waPhoneNumber.findUnique({
    where: { phoneNumberId: payload.phoneNumberId },
  });
  const phoneData = {
    accountId: acc.id,
    phoneNumberId: payload.phoneNumberId,
    displayPhoneNumber: payload.displayPhoneNumber,
    label: payload.displayName ?? null,
    active: true,
    onboardingFlow: payload.onboardingFlow ?? "embedded_signup",
  };
  if (phoneExisting) {
    await db.waPhoneNumber.update({ where: { id: phoneExisting.id }, data: phoneData });
  } else {
    await db.waPhoneNumber.create({ data: phoneData });
  }
  return { account: await buildAccountWithPhones(acc.id) };
}

export async function setCommerceCatalog(payload: SetCommerceCatalogPayload): Promise<void> {
  await db.waBusinessAccount.update({
    where: { id: payload.accountId },
    data: { commerceCatalogId: payload.catalogId },
  });
}

export async function listCommerceProductsForAccount(
  payload: ListCommerceProductsPayload
): Promise<ListCommerceProductsResponse> {
  const account = await db.waBusinessAccount.findUnique({
    where: { id: payload.accountId },
    select: { commerceCatalogId: true },
  });
  if (!account?.commerceCatalogId) {
    return { catalogId: null, products: [] };
  }
  const products = await listCommerceProducts(
    account.commerceCatalogId,
    payload.accountId,
    payload.search,
    payload.limit
  );
  return { catalogId: account.commerceCatalogId, products };
}

export async function sendSingleProduct(
  payload: SendSingleProductPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: payload.phoneNumberId },
    select: { account: { select: { commerceCatalogId: true } } },
  });
  if (!phone?.account.commerceCatalogId) {
    throw new DomainError("BAD_REQUEST", "Catálogo Meta Commerce no configurado en esta cuenta");
  }
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError(
      "BAD_REQUEST",
      "Ventana 24h cerrada. El producto único requiere ventana abierta."
    );
  }
  const apiResp = await sendSingleProductMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    catalogId: phone.account.commerceCatalogId,
    productRetailerId: payload.productRetailerId,
    bodyText: payload.bodyText,
    footerText: payload.footerText,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const preview = `[producto] ${payload.productRetailerId}`;
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: payload.bodyText ?? null,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        interactive_type: "product",
        catalog_id: phone.account.commerceCatalogId,
        product_retailer_id: payload.productRetailerId,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview.slice(0, 200) },
  });
  return { message } as unknown as SendMessageResponse;
}

export async function sendMultiProduct(
  payload: SendMultiProductPayload,
  sentByUserId: number
): Promise<SendMessageResponse> {
  const conv = await db.waConversation.findUnique({
    where: { id: payload.conversationId },
    include: { contact: true },
  });
  if (!conv) throw new DomainError("NOT_FOUND", "Conversación no encontrada");
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: payload.phoneNumberId },
    select: { account: { select: { commerceCatalogId: true } } },
  });
  if (!phone?.account.commerceCatalogId) {
    throw new DomainError("BAD_REQUEST", "Catálogo Meta Commerce no configurado en esta cuenta");
  }
  if (!windowOpen(conv.lastInboundAt)) {
    throw new DomainError("BAD_REQUEST", "Ventana 24h cerrada. MPM requiere ventana abierta.");
  }
  const apiResp = await sendMultiProductMessage({
    phoneNumberId: payload.phoneNumberId,
    toE164: conv.contact.phoneE164,
    catalogId: phone.account.commerceCatalogId,
    bodyText: payload.bodyText,
    headerText: payload.headerText,
    footerText: payload.footerText,
    sections: payload.sections,
    contextMessageId: payload.contextMetaMessageId,
  });
  const metaId = apiResp.messages?.[0]?.id ?? null;
  const now = new Date();
  const total = payload.sections.reduce((n, s) => n + s.product_items.length, 0);
  const preview = `[catálogo] ${payload.headerText} (${total} productos)`;
  const message = await db.waMessage.create({
    data: {
      conversationId: conv.id,
      contactId: conv.contactId,
      phoneNumberId: payload.phoneNumberId,
      metaMessageId: metaId,
      direction: "OUTBOUND",
      type: "INTERACTIVE",
      status: "SENT",
      body: payload.bodyText,
      sentByUserId,
      contextMetaMessageId: payload.contextMetaMessageId ?? null,
      payload: {
        interactive_type: "product_list",
        catalog_id: phone.account.commerceCatalogId,
        sections: payload.sections,
      } as never,
      timestamp: now,
    },
  });
  await db.waConversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: now, lastMessagePreview: preview.slice(0, 200) },
  });
  return { message } as unknown as SendMessageResponse;
}
