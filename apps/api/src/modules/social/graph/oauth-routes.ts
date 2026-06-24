// Flujo OAuth oficial de Meta (Facebook Login for Business) para conectar una
// cuenta de redes. Son rutas Hono planas (NO oRPC) porque son redirecciones del
// navegador:
//
//   GET /api/social/oauth/start    → 302 al diálogo de OAuth de Meta
//   GET /api/social/oauth/callback → intercambia code → tokens → upsert cuenta
//
// La config de la Meta App (appId/appSecret/configId/graphVersion) vive en DB
// (Setting `social.meta.*`), no en env. El único env es `PUBLIC_URL` (host del
// api, para construir el redirect_uri) y `APP_URL` (host de la intranet, para
// volver a la UI tras el callback).
//
// El redirect_uri DEBE coincidir EXACTAMENTE con el registrado en la Meta App:
//   <PUBLIC_URL>/api/social/oauth/callback

import { db } from "@finanzas/db";
import { randomBytes } from "node:crypto";
import type { Hono } from "hono";

import { getSessionUser, hasPermission } from "../../../lib/auth.ts";
import { encryptSecret } from "../../../lib/secret-cipher.ts";
import { logEvent, logWarn } from "../../../lib/logger.ts";
import { getMetaAppConfig } from "../../../lib/social-settings.ts";
import { GRAPH_BASE } from "./_http.ts";
import { exchangeForLongLivedToken, fetchPageAndIgIds } from "./oauth.ts";

const FB_DIALOG_BASE = "https://www.facebook.com";

// Host del api (donde corre el callback). El redirect_uri se construye desde acá
// y DEBE coincidir con el registrado en la Meta App.
const API_BASE = process.env.PUBLIC_URL || "http://localhost:3000";
// Host de la intranet (donde vuelve el navegador tras el callback).
const FRONTEND_BASE = process.env.APP_URL || "http://localhost:5173";

const CALLBACK_PATH = "/api/social/oauth/callback";
const UI_PATH = "/social?tab=accounts";

function redirectUri(): string {
  return `${API_BASE}${CALLBACK_PATH}`;
}

function uiRedirect(qs: string): string {
  const sep = UI_PATH.includes("?") ? "&" : "?";
  return `${FRONTEND_BASE}${UI_PATH}${sep}${qs}`;
}

// ─── CSRF state store (in-memory, TTL 10min, single-process api) ──────────────
const stateStore = new Map<string, number>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const now = Date.now();
  for (const [k, ts] of stateStore.entries()) {
    if (now - ts > STATE_TTL_MS) stateStore.delete(k);
  }
}

function issueState(): string {
  pruneStates();
  const state = randomBytes(24).toString("base64url");
  stateStore.set(state, Date.now());
  return state;
}

function verifyState(state: string): boolean {
  pruneStates();
  const ts = stateStore.get(state);
  if (!ts) return false;
  stateStore.delete(state);
  return Date.now() - ts <= STATE_TTL_MS;
}

type CallbackTokenResponse = { access_token?: string; error?: { message?: string } };

/** Intercambia el `code` del callback por un user token short-lived. */
async function exchangeCodeForUserToken(
  code: string,
  appId: string,
  appSecret: string,
  version: string
): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/${version}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("code", code);
  const res = await fetch(url);
  const json = (await res.json()) as CallbackTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error?.message ?? `code exchange ${res.status}`);
  }
  return json.access_token;
}

export function registerSocialOauthRoutes(app: Hono): void {
  // ── START: construye y redirige al diálogo de OAuth de Meta ──
  app.get("/api/social/oauth/start", async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      // Sin sesión → manda al login de la intranet, que reintenta tras autenticar.
      return c.redirect(`${FRONTEND_BASE}/login?redirect=${encodeURIComponent(UI_PATH)}`);
    }
    const canConnect = await hasPermission(user, "create", "SocialAccount");
    if (!canConnect) {
      return c.redirect(uiRedirect("social_error=forbidden"));
    }

    const config = await getMetaAppConfig();
    if (!config.appId || !config.configId || !config.hasSecret) {
      return c.redirect(uiRedirect("social_error=meta_config_incompleta"));
    }

    const state = issueState();
    const dialog = new URL(`${FB_DIALOG_BASE}/${config.graphVersion}/dialog/oauth`);
    dialog.searchParams.set("client_id", config.appId);
    dialog.searchParams.set("redirect_uri", redirectUri());
    dialog.searchParams.set("config_id", config.configId);
    dialog.searchParams.set("state", state);
    dialog.searchParams.set("response_type", "code");
    return c.redirect(dialog.toString());
  });

  // ── CALLBACK: intercambia code → tokens → deriva page/IG → upsert cuenta ──
  app.get(CALLBACK_PATH, async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const err = c.req.query("error");
    const errReason = c.req.query("error_description") ?? c.req.query("error_reason");

    if (err) {
      return c.redirect(uiRedirect(`social_error=${encodeURIComponent(errReason ?? err)}`));
    }
    if (!code || !state) {
      return c.redirect(uiRedirect("social_error=missing_code_or_state"));
    }
    if (!verifyState(state)) {
      return c.redirect(uiRedirect("social_error=invalid_state"));
    }

    try {
      const config = await getMetaAppConfig();
      if (!config.appId || !config.hasSecret) {
        return c.redirect(uiRedirect("social_error=meta_config_incompleta"));
      }

      const shortToken = await exchangeCodeForUserToken(
        code,
        config.appId,
        config.appSecret,
        config.graphVersion
      );
      const longLived = await exchangeForLongLivedToken(
        shortToken,
        config.appId,
        config.appSecret,
        config.graphVersion
      );
      const derived = await fetchPageAndIgIds(longLived.token, config.graphVersion);

      // Upsert por fbPageId (la página de FB es la identidad estable de la cuenta).
      const existing = await db.socialAccount.findFirst({ where: { fbPageId: derived.fbPageId } });
      const data = {
        provider: "META" as const,
        appId: config.appId,
        appSecret: encryptSecret(config.appSecret),
        userAccessToken: encryptSecret(longLived.token),
        pageAccessToken: encryptSecret(derived.pageAccessToken),
        fbPageId: derived.fbPageId,
        igUserId: derived.igUserId,
        tokenExpiresAt: longLived.expiresAt,
        graphApiVersion: config.graphVersion,
        active: true,
      };
      const account = existing
        ? await db.socialAccount.update({ where: { id: existing.id }, data })
        : await db.socialAccount.create({ data });

      logEvent("social.oauth.connected", {
        accountId: account.id,
        fbPageId: derived.fbPageId,
        hasIg: derived.igUserId !== null,
      });
      return c.redirect(uiRedirect("social_connected=1"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      logWarn("[social.oauth] callback failed", { error: msg });
      return c.redirect(uiRedirect(`social_error=${encodeURIComponent(msg)}`));
    }
  });
}
