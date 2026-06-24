// OAuth de TikTok (PKCE) para Content Posting. Intercambio code→tokens, refresh
// del access_token vía refresh_token, y refresh proactivo antes de expirar.
//
// access_token  vive ~24h  → refrescamos cuando está por expirar.
// refresh_token vive ~365d → puede ROTAR en cada refresh; siempre guardamos el
//                            más nuevo que devuelve TikTok.

import { db } from "@finanzas/db";
import { encryptSecret } from "../../../lib/secret-cipher.ts";
import { logEvent, logWarn } from "../../../lib/logger.ts";
import { TIKTOK_API_BASE, type LoadedTiktokAccount } from "./_http.ts";

const TOKEN_ENDPOINT = `${TIKTOK_API_BASE}/v2/oauth/token/`;
// access_token dura ~24h; refrescamos si quedan <30 min.
const REFRESH_WINDOW_MS = 30 * 60 * 1000;

export interface TiktokTokenResult {
  openId: string;
  accessToken: string;
  refreshToken: string;
  /** Expiración absoluta del access_token. */
  expiresAt: Date | null;
  /** Expiración absoluta del refresh_token. */
  refreshExpiresAt: Date | null;
  scope: string;
}

interface TiktokTokenResponse {
  open_id?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

function toResult(json: TiktokTokenResponse): TiktokTokenResult {
  if (!json.access_token || !json.refresh_token || !json.open_id) {
    const detail = json.error_description ?? json.error ?? "respuesta sin tokens";
    throw new Error(`TikTok token: ${detail}`);
  }
  const now = Date.now();
  return {
    openId: json.open_id,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? new Date(now + json.expires_in * 1000) : null,
    refreshExpiresAt: json.refresh_expires_in
      ? new Date(now + json.refresh_expires_in * 1000)
      : null,
    scope: json.scope ?? "",
  };
}

/** Intercambia el `code` del callback por tokens (grant_type=authorization_code, PKCE). */
export async function exchangeCodeForTokens(params: {
  clientKey: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<TiktokTokenResult> {
  const body = new URLSearchParams({
    client_key: params.clientKey,
    client_secret: params.clientSecret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TiktokTokenResponse;
  if (!res.ok) {
    throw new Error(
      `TikTok token exchange ${res.status}: ${json.error_description ?? json.error ?? "error"}`
    );
  }
  return toResult(json);
}

/** Refresca el access_token vía refresh_token (el refresh_token puede rotar). */
export async function refreshAccessToken(params: {
  clientKey: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TiktokTokenResult> {
  const body = new URLSearchParams({
    client_key: params.clientKey,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken,
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as TiktokTokenResponse;
  if (!res.ok) {
    throw new Error(
      `TikTok token refresh ${res.status}: ${json.error_description ?? json.error ?? "error"}`
    );
  }
  return toResult(json);
}

/**
 * Devuelve un access_token válido para la cuenta, refrescando proactivamente si
 * está por expirar. Persiste el nuevo access_token + refresh_token rotado.
 */
export async function getValidTiktokAccessToken(account: LoadedTiktokAccount): Promise<string> {
  if (!account.accessToken) {
    throw new Error(`SocialAccount ${account.id} sin access_token`);
  }
  const expiringSoon =
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;
  if (!expiringSoon || !account.refreshToken || !account.clientKey || !account.clientSecret) {
    return account.accessToken;
  }
  try {
    const refreshed = await refreshAccessToken({
      clientKey: account.clientKey,
      clientSecret: account.clientSecret,
      refreshToken: account.refreshToken,
    });
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        pageAccessToken: encryptSecret(refreshed.accessToken),
        refreshToken: encryptSecret(refreshed.refreshToken),
        tokenExpiresAt: refreshed.expiresAt,
        refreshExpiresAt: refreshed.refreshExpiresAt,
        externalUserId: refreshed.openId,
      },
    });
    logEvent("social.tiktok.token.refreshed", { accountId: account.id });
    return refreshed.accessToken;
  } catch (e) {
    logWarn("[social.tiktok] token refresh failed", {
      accountId: account.id,
      error: e instanceof Error ? e.message : "unknown",
    });
    // Si el refresh falla, seguimos con el token actual (puede aún ser válido).
    return account.accessToken;
  }
}
