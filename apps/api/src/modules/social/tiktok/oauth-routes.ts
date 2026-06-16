// Flujo OAuth (PKCE) de TikTok para conectar una cuenta de Content Posting.
// Rutas Hono planas (NO oRPC) porque son redirecciones del navegador:
//
//   GET /api/social/tiktok/oauth/start    → 302 al diálogo de TikTok
//   GET /api/social/tiktok/oauth/callback → code+verifier → tokens → upsert cuenta
//
// La config (clientKey/clientSecret) vive en DB (Setting `social.tiktok.*`).
// El redirect_uri DEBE coincidir EXACTAMENTE con el registrado en el portal de
// TikTok: <PUBLIC_URL>/api/social/tiktok/oauth/callback

import { db } from "@finanzas/db";
import { createHash, randomBytes } from "node:crypto";
import type { Hono } from "hono";

import { getSessionUser, hasPermission } from "../../../lib/auth.ts";
import { encryptSecret } from "../../../lib/secret-cipher.ts";
import { logEvent, logWarn } from "../../../lib/logger.ts";
import { getTiktokConfig } from "../../../lib/social-settings.ts";
import { exchangeCodeForTokens } from "./oauth.ts";

const TIKTOK_AUTHORIZE_BASE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_SCOPE = "user.info.basic,video.publish,video.upload";

// Host del api (donde corre el callback). El redirect_uri se construye desde acá.
const API_BASE = process.env.PUBLIC_URL || "http://localhost:3000";
// Host de la intranet (donde vuelve el navegador tras el callback).
const FRONTEND_BASE = process.env.APP_URL || "http://localhost:5173";

const CALLBACK_PATH = "/api/social/tiktok/oauth/callback";
const UI_PATH = "/social?tab=accounts";

function redirectUri(): string {
  return `${API_BASE}${CALLBACK_PATH}`;
}

function uiRedirect(qs: string): string {
  const sep = UI_PATH.includes("?") ? "&" : "?";
  return `${FRONTEND_BASE}${UI_PATH}${sep}${qs}`;
}

// ─── CSRF state + PKCE verifier store (in-memory, TTL 10min, single-process) ──
interface PendingAuth {
  ts: number;
  codeVerifier: string;
}
const stateStore = new Map<string, PendingAuth>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const now = Date.now();
  for (const [k, v] of stateStore.entries()) {
    if (now - v.ts > STATE_TTL_MS) stateStore.delete(k);
  }
}

/** PKCE: code_verifier aleatorio + code_challenge = base64url(SHA256(verifier)). */
function issueAuth(): { state: string; codeVerifier: string; codeChallenge: string } {
  pruneStates();
  const state = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  stateStore.set(state, { ts: Date.now(), codeVerifier });
  return { state, codeVerifier, codeChallenge };
}

function consumeAuth(state: string): string | null {
  pruneStates();
  const pending = stateStore.get(state);
  if (!pending) return null;
  stateStore.delete(state);
  if (Date.now() - pending.ts > STATE_TTL_MS) return null;
  return pending.codeVerifier;
}

export function registerTiktokOauthRoutes(app: Hono): void {
  // ── START: construye y redirige al diálogo de OAuth de TikTok (PKCE) ──
  app.get("/api/social/tiktok/oauth/start", async (c) => {
    const user = await getSessionUser(c);
    if (!user) {
      return c.redirect(`${FRONTEND_BASE}/login?redirect=${encodeURIComponent(UI_PATH)}`);
    }
    const canConnect = await hasPermission(user, "create", "SocialAccount");
    if (!canConnect) {
      return c.redirect(uiRedirect("social_error=forbidden"));
    }

    const config = await getTiktokConfig();
    if (!config.clientKey || !config.hasSecret) {
      return c.redirect(uiRedirect("social_error=tiktok_config_incompleta"));
    }

    const { state, codeChallenge } = issueAuth();
    const dialog = new URL(TIKTOK_AUTHORIZE_BASE);
    dialog.searchParams.set("client_key", config.clientKey);
    dialog.searchParams.set("scope", TIKTOK_SCOPE);
    dialog.searchParams.set("response_type", "code");
    dialog.searchParams.set("redirect_uri", redirectUri());
    dialog.searchParams.set("state", state);
    dialog.searchParams.set("code_challenge", codeChallenge);
    dialog.searchParams.set("code_challenge_method", "S256");
    return c.redirect(dialog.toString());
  });

  // ── CALLBACK: intercambia code (+verifier) → tokens → upsert cuenta ──
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
    const codeVerifier = consumeAuth(state);
    if (!codeVerifier) {
      return c.redirect(uiRedirect("social_error=invalid_state"));
    }

    try {
      const config = await getTiktokConfig();
      if (!config.clientKey || !config.hasSecret) {
        return c.redirect(uiRedirect("social_error=tiktok_config_incompleta"));
      }

      const tokens = await exchangeCodeForTokens({
        clientKey: config.clientKey,
        clientSecret: config.clientSecret,
        code,
        redirectUri: redirectUri(),
        codeVerifier,
      });

      // Upsert por (provider=TIKTOK, externalUserId=open_id) — identidad estable.
      const existing = await db.socialAccount.findFirst({
        where: { provider: "TIKTOK", externalUserId: tokens.openId },
      });
      const data = {
        provider: "TIKTOK" as const,
        appId: config.clientKey,
        appSecret: encryptSecret(config.clientSecret),
        pageAccessToken: encryptSecret(tokens.accessToken),
        refreshToken: encryptSecret(tokens.refreshToken),
        externalUserId: tokens.openId,
        tokenExpiresAt: tokens.expiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        active: true,
      };
      const account = existing
        ? await db.socialAccount.update({ where: { id: existing.id }, data })
        : await db.socialAccount.create({ data });

      logEvent("social.tiktok.oauth.connected", {
        accountId: account.id,
        openId: tokens.openId,
      });
      return c.redirect(uiRedirect("social_connected=1"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      logWarn("[social.tiktok.oauth] callback failed", { error: msg });
      return c.redirect(uiRedirect(`social_error=${encodeURIComponent(msg)}`));
    }
  });
}
