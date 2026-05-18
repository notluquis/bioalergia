// GET /api/ml/oauth/callback?code=...&state=...
//
// MercadoLibre redirige acá tras autorización. Validamos state, intercambiamos
// code por tokens (encriptados), redirigimos a la UI intranet.

import type { Hono } from "hono";

import { exchangeCodeForTokens, persistTokens } from "../modules/mercadolibre/auth.ts";
import { verifyOAuthState } from "../orpc/ml-sync.ts";

const SETTINGS_PATH = "/settings/mercadolibre";

export function registerMercadolibreOauthCallback(app: Hono) {
  app.get("/api/ml/oauth/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const err = c.req.query("error");

    if (err) {
      return c.redirect(`${SETTINGS_PATH}?ml_error=${encodeURIComponent(err)}`);
    }
    if (!code || !state) {
      return c.redirect(`${SETTINGS_PATH}?ml_error=missing_code_or_state`);
    }
    if (!verifyOAuthState(state)) {
      return c.redirect(`${SETTINGS_PATH}?ml_error=invalid_state`);
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      await persistTokens(tokens);
      return c.redirect(`${SETTINGS_PATH}?ml_connected=1`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      return c.redirect(`${SETTINGS_PATH}?ml_error=${encodeURIComponent(msg)}`);
    }
  });
}
