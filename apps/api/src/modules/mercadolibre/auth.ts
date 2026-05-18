// OAuth2 con MercadoLibre. Tokens encriptados AES-256-GCM con WA_SECRET_KEY
// (reuso del helper existente). Refresh proactivo si expira en < 1h.
//
// Env requeridos:
//   ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI

import { db } from "@finanzas/db";
import { decryptSecret, encryptSecret } from "../../lib/secret-cipher.ts";

const ML_OAUTH_BASE = "https://api.mercadolibre.com/oauth/token";
const ML_AUTH_BASE = "https://auth.mercadolibre.cl/authorization";
const REFRESH_THRESHOLD_MS = 60 * 60 * 1000; // 1h

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[ml-auth] missing env ${name}`);
  return v;
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env("ML_CLIENT_ID"),
    redirect_uri: env("ML_REDIRECT_URI"),
    state,
  });
  return `${ML_AUTH_BASE}?${params.toString()}`;
}

type MlTokenResponse = {
  access_token: string;
  refresh_token: string;
  user_id: number | string;
  expires_in: number;
  scope?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<MlTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: env("ML_CLIENT_ID"),
    client_secret: env("ML_CLIENT_SECRET"),
    code,
    redirect_uri: env("ML_REDIRECT_URI"),
  });
  const res = await fetch(ML_OAUTH_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[ml-auth] exchange failed ${res.status}: ${errBody}`);
  }
  return (await res.json()) as MlTokenResponse;
}

async function refreshTokens(refreshToken: string): Promise<MlTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env("ML_CLIENT_ID"),
    client_secret: env("ML_CLIENT_SECRET"),
    refresh_token: refreshToken,
  });
  const res = await fetch(ML_OAUTH_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`[ml-auth] refresh failed ${res.status}: ${errBody}`);
  }
  return (await res.json()) as MlTokenResponse;
}

export async function persistTokens(tokens: MlTokenResponse) {
  const mlUserId = String(tokens.user_id);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await db.mlOauthToken.upsert({
    where: { mlUserId },
    create: {
      mlUserId,
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      expiresAt,
      scope: tokens.scope ?? null,
    },
    update: {
      accessTokenEnc: encryptSecret(tokens.access_token),
      refreshTokenEnc: encryptSecret(tokens.refresh_token),
      expiresAt,
      scope: tokens.scope ?? null,
    },
  });
}

export async function getActiveAccessToken(): Promise<{
  accessToken: string;
  mlUserId: string;
} | null> {
  // MVP singleton: usamos el row más reciente.
  const row = await db.mlOauthToken.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return null;

  const expiringSoon = row.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS;
  if (expiringSoon) {
    const refresh = decryptSecret(row.refreshTokenEnc);
    if (!refresh) throw new Error("[ml-auth] refresh token decrypt failed");
    const fresh = await refreshTokens(refresh);
    await persistTokens(fresh);
    return { accessToken: fresh.access_token, mlUserId: String(fresh.user_id) };
  }

  const access = decryptSecret(row.accessTokenEnc);
  if (!access) throw new Error("[ml-auth] access token decrypt failed");
  return { accessToken: access, mlUserId: row.mlUserId };
}

export async function disconnectMl(): Promise<void> {
  await db.mlOauthToken.deleteMany({});
}

export async function getConnectionStatus() {
  const row = await db.mlOauthToken.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!row) return { connected: false as const };
  return {
    connected: true as const,
    mlUserId: row.mlUserId,
    expiresAt: row.expiresAt,
    scope: row.scope,
  };
}
