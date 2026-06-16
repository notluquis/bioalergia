// OAuth de Meta para redes: intercambio short→long-lived (60d), derivación del
// page token + IDs (IG business / FB page), y refresh proactivo antes de expirar.
// El page token derivado de un user token long-lived no expira; igual refrescamos
// si hay ventana de expiración seteada.

import { db } from "@finanzas/db";
import { encryptSecret } from "../../../lib/secret-cipher.ts";
import { logEvent } from "../../../lib/logger.ts";
import { GRAPH_BASE, type LoadedSocialAccount } from "./_http.ts";

const REFRESH_WINDOW_MS = 7 * 24 * 3600 * 1000; // refrescar si quedan <7 días

type TokenResponse = { access_token: string; expires_in?: number };
type AccountsResponse = { data?: { id: string; access_token: string }[] };
type IgResponse = { instagram_business_account?: { id: string } };

/** Intercambia un user token short-lived por uno long-lived (~60 días). */
export async function exchangeForLongLivedToken(
  shortToken: string,
  appId: string,
  appSecret: string,
  version: string,
): Promise<{ token: string; expiresAt: Date | null }> {
  const url = new URL(`${GRAPH_BASE}/${version}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Token exchange ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as TokenResponse;
  const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000) : null;
  return { token: json.access_token, expiresAt };
}

/** Deriva page token + page id + IG business id desde un user token long-lived. */
export async function fetchPageAndIgIds(
  userToken: string,
  version: string,
): Promise<{ fbPageId: string; pageAccessToken: string; igUserId: string | null }> {
  const accRes = await fetch(`${GRAPH_BASE}/${version}/me/accounts?access_token=${encodeURIComponent(userToken)}`);
  if (!accRes.ok) throw new Error(`/me/accounts ${accRes.status}: ${(await accRes.text()).slice(0, 200)}`);
  const accounts = (await accRes.json()) as AccountsResponse;
  const page = accounts.data?.[0];
  if (!page) throw new Error("La cuenta no administra ninguna página de Facebook");
  const igRes = await fetch(
    `${GRAPH_BASE}/${version}/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`,
  );
  const ig = igRes.ok ? ((await igRes.json()) as IgResponse) : {};
  return {
    fbPageId: page.id,
    pageAccessToken: page.access_token,
    igUserId: ig.instagram_business_account?.id ?? null,
  };
}

/**
 * Devuelve un page token válido para la cuenta, refrescando proactivamente si
 * está por expirar (best-effort: solo si hay userAccessToken + appId/appSecret).
 */
export async function getValidPageToken(account: LoadedSocialAccount): Promise<string> {
  if (!account.pageAccessToken) {
    throw new Error(`SocialAccount ${account.id} sin pageAccessToken`);
  }
  const expiringSoon = account.tokenExpiresAt && account.tokenExpiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;
  if (!expiringSoon || !account.userAccessToken || !account.appId || !account.appSecret) {
    return account.pageAccessToken;
  }
  try {
    const exchanged = await exchangeForLongLivedToken(
      account.userAccessToken,
      account.appId,
      account.appSecret,
      account.graphApiVersion,
    );
    const derived = await fetchPageAndIgIds(exchanged.token, account.graphApiVersion);
    await db.socialAccount.update({
      where: { id: account.id },
      data: {
        userAccessToken: encryptSecret(exchanged.token),
        pageAccessToken: encryptSecret(derived.pageAccessToken),
        tokenExpiresAt: exchanged.expiresAt,
      },
    });
    logEvent("social.token.refreshed", { accountId: account.id });
    return derived.pageAccessToken;
  } catch {
    // Si el refresh falla, seguimos con el token actual (puede aún ser válido).
    return account.pageAccessToken;
  }
}
