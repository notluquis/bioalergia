// Capa HTTP de la TikTok Content Posting API (espejo de social/graph/_http.ts).
// Carga la SocialAccount con los tokens DESENCRIPTADOS (access_token en
// pageAccessToken, refresh_token en refreshToken). open_id vive en externalUserId.

import { db } from "@finanzas/db";
import { logWarn } from "../../../lib/logger.ts";
import { decryptSecret } from "../../../lib/secret-cipher.ts";

export const TIKTOK_API_BASE = "https://open.tiktokapis.com";

export interface LoadedTiktokAccount {
  id: number;
  /** TikTok open_id (identidad estable del creador). */
  openId: string | null;
  /** access_token (válido ~24h). */
  accessToken: string | null;
  /** refresh_token (válido ~365d, puede rotar en cada refresh). */
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  refreshExpiresAt: Date | null;
  clientKey: string | null;
  clientSecret: string | null;
}

/** Carga la cuenta TikTok con access/refresh token desencriptados. */
export async function loadTiktokAccount(accountId: number): Promise<LoadedTiktokAccount | null> {
  const account = await db.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;
  return {
    id: account.id,
    openId: account.externalUserId,
    accessToken: decryptSecret(account.pageAccessToken),
    refreshToken: decryptSecret(account.refreshToken),
    tokenExpiresAt: account.tokenExpiresAt,
    refreshExpiresAt: account.refreshExpiresAt,
    clientKey: account.appId,
    clientSecret: decryptSecret(account.appSecret),
  };
}

export function requireAccessToken(account: LoadedTiktokAccount): string {
  if (!account.accessToken) {
    throw new Error(`SocialAccount ${account.id} sin access_token — conecta la cuenta de TikTok`);
  }
  return account.accessToken;
}

/** POST JSON contra la TikTok API (Bearer access_token, charset UTF-8 oficial). */
export async function tiktokPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${TIKTOK_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    logWarn("[social.tiktok] POST failed", { path, status: res.status, body: text.slice(0, 500) });
    throw new Error(`TikTok API ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = JSON.parse(text) as TiktokEnvelope<T>;
  // TikTok envuelve todo en { data, error: { code: "ok" | ... } }.
  if (json.error && json.error.code && json.error.code !== "ok") {
    logWarn("[social.tiktok] API error", { path, error: json.error });
    throw new Error(`TikTok API error ${json.error.code}: ${json.error.message ?? ""}`.trim());
  }
  return json.data as T;
}

interface TiktokEnvelope<T> {
  data?: T;
  error?: { code?: string; message?: string; log_id?: string };
}
