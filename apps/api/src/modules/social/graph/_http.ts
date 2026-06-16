// Capa HTTP del Graph API de Meta para redes sociales (espejo de
// wa-cloud/graph/_http.ts). Carga la SocialAccount con tokens DESENCRIPTADOS.

import { db } from "@finanzas/db";
import { logWarn } from "../../../lib/logger.ts";
import { decryptSecret } from "../../../lib/secret-cipher.ts";

export const GRAPH_BASE = "https://graph.facebook.com";

export interface LoadedSocialAccount {
  id: number;
  igUserId: string | null;
  fbPageId: string | null;
  pageAccessToken: string | null;
  userAccessToken: string | null;
  appId: string | null;
  appSecret: string | null;
  tokenExpiresAt: Date | null;
  graphApiVersion: string;
}

/** Carga la cuenta con pageAccessToken / userAccessToken / appSecret desencriptados. */
export async function loadSocialAccount(accountId: number): Promise<LoadedSocialAccount | null> {
  const account = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;
  return {
    id: account.id,
    igUserId: account.igUserId,
    fbPageId: account.fbPageId,
    pageAccessToken: decryptSecret(account.pageAccessToken),
    userAccessToken: decryptSecret(account.userAccessToken),
    appId: account.appId,
    appSecret: decryptSecret(account.appSecret),
    tokenExpiresAt: account.tokenExpiresAt,
    graphApiVersion: account.graphApiVersion,
  };
}

export function requirePageToken(account: LoadedSocialAccount): string {
  if (!account.pageAccessToken) {
    throw new Error(`SocialAccount ${account.id} sin pageAccessToken — conecta la cuenta de Meta`);
  }
  return account.pageAccessToken;
}

export async function graphPost<T>(path: string, body: unknown, token: string, version: string): Promise<T> {
  const res = await fetch(`${GRAPH_BASE}/${version}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[social.graph] POST failed", { path, status: res.status, body: text.slice(0, 500) });
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
    logWarn("[social.graph] GET failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`Graph API ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}
