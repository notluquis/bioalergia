import { db } from "@finanzas/db";
import { logWarn } from "../../../lib/logger.ts";
import { decryptSecret } from "../../../lib/secret-cipher.ts";

export const GRAPH_BASE = "https://graph.facebook.com";

// Returns the phone with `account.systemUserToken` (and appSecret /
// webhookVerifyToken) DECRYPTED in-place. Always use this helper rather
// than reading the raw `db.waBusinessAccount.systemUserToken` field —
// values stored after the encryption rollout begin with `enc:v1:` and
// are unusable as Bearer tokens until decrypted.
export async function getAccountForPhoneNumber(phoneNumberId: number) {
  const phone = await db.waPhoneNumber.findUnique({
    where: { id: phoneNumberId },
    include: { account: true },
  });
  if (!phone) throw new Error(`WaPhoneNumber ${phoneNumberId} no existe`);
  phone.account.systemUserToken = decryptSecret(phone.account.systemUserToken);
  phone.account.appSecret = decryptSecret(phone.account.appSecret);
  phone.account.webhookVerifyToken = decryptSecret(phone.account.webhookVerifyToken);
  if (!phone.account.systemUserToken) {
    throw new Error("WaBusinessAccount sin systemUserToken — configura en Settings");
  }
  return phone;
}

// Narrowing helper: callers that already hold a `phone` from
// `getAccountForPhoneNumber` know the token is present (that function
// throws otherwise), but TS still types `systemUserToken` as
// `string | null` because it is reassigned from `decryptSecret`. This
// returns the token as a non-null `string`, throwing with a clear
// message if it is somehow absent — preserving the previous `!`
// runtime behavior without a non-null assertion.
export function requireSystemUserToken(phone: {
  account: { systemUserToken: string | null };
}): string {
  const token = phone.account.systemUserToken;
  if (!token) {
    throw new Error("WaBusinessAccount sin systemUserToken — configura en Settings");
  }
  return token;
}

// Same decryption logic for the account-only callers (templates, flows,
// analytics, media downloadUrl).
export async function loadAccount(accountId: number) {
  const account = await db.waBusinessAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;
  account.systemUserToken = decryptSecret(account.systemUserToken);
  account.appSecret = decryptSecret(account.appSecret);
  account.webhookVerifyToken = decryptSecret(account.webhookVerifyToken);
  return account;
}

export async function graphPost<T>(
  path: string,
  body: unknown,
  token: string,
  version: string
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] POST failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function graphGet<T>(path: string, token: string, version: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] GET failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export async function graphDelete<T>(
  path: string,
  body: unknown,
  token: string,
  version: string
): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[wa-cloud.graph] DELETE failed", {
      path,
      status: res.status,
      body: text.slice(0, 500),
    });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}
