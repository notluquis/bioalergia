import { randomBytes } from "node:crypto";
import { db } from "@finanzas/db";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import {
  clearDriveClientCache,
  getOAuthClientBase,
  validateOAuthToken,
} from "../lib/google/google-core";
import { logEvent, logWarn } from "../lib/logger";

const OAUTH_TOKEN_KEY = "GOOGLE_OAUTH_REFRESH_TOKEN";
const OAUTH_STATE_COOKIE = "oauth_state";

export const integrationRoutes = new Hono();

// 1. Get Auth URL - redirects user to Google consent screen
integrationRoutes.get("/google/url", async (c) => {
  try {
    const oauth2Client = await getOAuthClientBase();

    // Generate random state for CSRF protection
    const state = randomBytes(32).toString("hex");

    // Store state in secure cookie (10 minutes expiry)
    setCookie(c, OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: ["https://www.googleapis.com/auth/drive.file"],
      prompt: "consent", // Force refresh token generation
      state,
    });

    logEvent("google.oauth.auth_url_generated", {
      state: `${state.substring(0, 8)}...`,
    });

    return c.json({ url: authUrl });
  } catch (error) {
    console.error("Error generating auth url", error);
    return c.json({ error: "Failed to generate auth URL" }, 500);
  }
});

// 2. OAuth Callback - receives authorization code from Google redirect
integrationRoutes.get("/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");
  const errorDescription = c.req.query("error_description");

  // Get the frontend URL for redirects
  const frontendUrl = process.env.PUBLIC_URL || "http://localhost:5173";
  const settingsPath = "/settings/backups";

  // Get saved state from cookie
  const savedState = getCookie(c, OAUTH_STATE_COOKIE);

  // Clear the state cookie immediately
  deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" });

  // Handle errors from Google
  if (error) {
    logWarn("google.oauth.callback_error", { error, errorDescription });
    return c.redirect(`${frontendUrl}${settingsPath}?error=${encodeURIComponent(error)}`);
  }

  // Verify state matches (CSRF protection)
  if (!state || !savedState || state !== savedState) {
    logWarn("google.oauth.invalid_state", {
      hasState: !!state,
      hasSavedState: !!savedState,
      matches: state === savedState,
    });
    return c.redirect(`${frontendUrl}${settingsPath}?error=invalid_state`);
  }

  if (!code) {
    return c.redirect(`${frontendUrl}${settingsPath}?error=missing_code`);
  }

  try {
    const oauth2Client = await getOAuthClientBase();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      logWarn("google.oauth.no_refresh_token", {});
      return c.redirect(`${frontendUrl}${settingsPath}?error=no_refresh_token`);
    }

    // Save refresh token to DB
    await db.setting.upsert({
      where: { key: OAUTH_TOKEN_KEY },
      create: { key: OAUTH_TOKEN_KEY, value: tokens.refresh_token },
      update: { value: tokens.refresh_token },
    });

    // Clear any cached OAuth client to use new token
    clearDriveClientCache();

    logEvent("google.oauth.connected", { source: "callback" });

    // Redirect to frontend with success
    return c.redirect(`${frontendUrl}${settingsPath}?connected=true`);
  } catch (err) {
    console.error("Error exchanging code for tokens:", err);
    logWarn("google.oauth.token_exchange_failed", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return c.redirect(`${frontendUrl}${settingsPath}?error=token_exchange_failed`);
  }
});

// 3. Disconnect - removes stored OAuth token
integrationRoutes.delete("/google/disconnect", async (c) => {
  try {
    await db.setting
      .delete({
        where: { key: OAUTH_TOKEN_KEY },
      })
      .catch(() => {
        // Ignore if not found
      });

    // Clear cached client
    clearDriveClientCache();

    logEvent("google.oauth.disconnected", {});

    return c.json({ success: true });
  } catch (_error) {
    return c.json({ error: "Failed to disconnect" }, 500);
  }
});

// 4. Status - with REAL token validation
integrationRoutes.get("/google/status", async (c) => {
  const validation = await validateOAuthToken();

  return c.json({
    configured: validation.configured,
    valid: validation.valid,
    source: validation.source,
    error: validation.error,
    errorCode: validation.errorCode,
  });
});
