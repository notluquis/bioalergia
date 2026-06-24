// GET /api/ml/callback?code=...&state=...
//
// MercadoLibre redirige acá tras autorización. La ruta DEBE coincidir con
// `ML_REDIRECT_URI` (env) y con la redirect URI registrada en el panel de la
// app ML — ambas usan `/api/ml/callback`. Validamos state, intercambiamos
// code por tokens (encriptados), redirigimos a la UI intranet.

import type { Hono } from "hono";

import { exchangeCodeForTokens, persistTokens } from "../modules/mercadolibre/auth.ts";
import { verifyOAuthState } from "../orpc/ml-sync.ts";

// La página de conexión ML vive en el tab `mercadolibre` del host /store y lee
// `ml_connected` / `ml_error` del querystring. El callback corre en el dominio
// del API (api.bioalergia.cl), así que el redirect DEBE ser absoluto al
// frontend (APP_URL = intranet) — un path relativo resolvería contra el API.
const FRONTEND_BASE = process.env.APP_URL || "http://localhost:5173";
const SETTINGS_PATH = "/store?tab=mercadolibre";

function uiRedirect(qs: string): string {
  return `${FRONTEND_BASE}${SETTINGS_PATH}&${qs}`;
}

export function registerMercadolibreOauthCallback(app: Hono) {
  app.get("/api/ml/callback", async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const err = c.req.query("error");

    if (err) {
      return c.redirect(uiRedirect(`ml_error=${encodeURIComponent(err)}`));
    }
    if (!code || !state) {
      return c.redirect(uiRedirect("ml_error=missing_code_or_state"));
    }
    if (!verifyOAuthState(state)) {
      return c.redirect(uiRedirect("ml_error=invalid_state"));
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      await persistTokens(tokens);
      return c.redirect(uiRedirect("ml_connected=1"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      return c.redirect(uiRedirect(`ml_error=${encodeURIComponent(msg)}`));
    }
  });
}
