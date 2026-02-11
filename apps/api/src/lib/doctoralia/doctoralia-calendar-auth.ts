/**
 * Doctoralia Calendar Authentication
 *
 * Handles Docplanner SSO flow:
 * 1. Login in l.doctoralia.cl (SSO)
 * 2. Handle 2FA when required
 * 3. Request OAuth code via provider metadata
 * 4. Exchange code for marketplace token in docplanner.doctoralia.cl
 */

import { request } from "gaxios";

const AUTH_BASE_URL = process.env.DOCTORALIA_CALENDAR_AUTH_BASE_URL || "https://l.doctoralia.cl";
const AUTH_BOOTSTRAP_PATH = process.env.DOCTORALIA_CALENDAR_AUTH_BOOTSTRAP_PATH || "/";
const LOGIN_PATH = process.env.DOCTORALIA_CALENDAR_LOGIN_PATH || "/login/check";
const TWO_FACTOR_PATH = process.env.DOCTORALIA_CALENDAR_2FA_PATH || "/2fa";
const DOCPLANNER_BASE_URL =
  process.env.DOCTORALIA_CALENDAR_DOCPLANNER_BASE_URL || "https://docplanner.doctoralia.cl";

const PHPSESSID_REGEX = /PHPSESSID=([^;]+)/;
const TWO_FACTOR_LOCATION_REGEX = /\/2fa(?:\?|$)/i;

// Token cache with expiration
let cachedToken: { token: string; expiresAt: number } | null = null;

type AuthProviderResponse = {
  url_login: string;
  client_id?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  redirect_uri?: string;
};

type WebTokenLoginResponse = {
  marketplaceToken?: {
    token?: string;
    expiresAt?: string;
    expires_in?: number;
  };
};

/**
 * Check if calendar credentials are configured
 */
export function isCalendarAuthConfigured(): boolean {
  return Boolean(
    process.env.DOCTORALIA_CALENDAR_USERNAME && process.env.DOCTORALIA_CALENDAR_PASSWORD,
  );
}

function extractLocationHeader(response: { headers: unknown }): string {
  const headers = response.headers as {
    get?: (name: string) => string | null;
    location?: string;
  };

  return headers.get?.("location") || headers.location || "";
}

function extractSessionId(cookies: string[]): string | undefined {
  for (const cookie of cookies) {
    const match = cookie.match(PHPSESSID_REGEX);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

function normalizeCookie(cookie: string): string {
  return cookie.split(";")[0]?.trim() || cookie.trim();
}

function cookieName(cookie: string): string {
  return normalizeCookie(cookie).split("=")[0]?.trim() || "";
}

function mergeCookies(...groups: string[][]): string[] {
  const byName = new Map<string, string>();

  for (const group of groups) {
    for (const cookie of group) {
      const normalized = normalizeCookie(cookie);
      const name = cookieName(normalized);
      if (!name) {
        continue;
      }
      byName.set(name, normalized);
    }
  }

  return [...byName.values()];
}

function buildCookieHeader(cookies: string[]): string {
  return mergeCookies(cookies).join("; ");
}

function extractCodeFromLocation(location: string): string | null {
  if (!location) {
    return null;
  }

  try {
    const url = new URL(location, DOCPLANNER_BASE_URL);
    return url.searchParams.get("code");
  } catch {
    return null;
  }
}

async function performLogin(
  username: string,
  password: string,
): Promise<{
  requiresTwoFactor: boolean;
  cookies: string[];
  sessionId?: string;
  location?: string;
}> {
  const bootstrapResponse = await request({
    url: `${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`,
    method: "GET",
    maxRedirects: 0,
    validateStatus: () => true,
  });
  const bootstrapCookies = bootstrapResponse.headers.getSetCookie?.() || [];

  const response = await request({
    url: `${AUTH_BASE_URL}${LOGIN_PATH}`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
      ...(bootstrapCookies.length > 0 ? { Cookie: buildCookieHeader(bootstrapCookies) } : {}),
    },
    data: new URLSearchParams({
      _username: username,
      _password: password,
      username,
      password,
    }).toString(),
    maxRedirects: 0,
    validateStatus: () => true,
  });

  const responseCookies = response.headers.getSetCookie?.() || [];
  const cookies = mergeCookies(bootstrapCookies, responseCookies);
  const location = extractLocationHeader(response);

  if (response.status < 200 || response.status >= 400) {
    throw new Error(
      `Login request failed (status=${response.status}, loginPath=${LOGIN_PATH}, location=${location || "n/a"})`,
    );
  }

  const requiresTwoFactor = TWO_FACTOR_LOCATION_REGEX.test(location);

  return {
    requiresTwoFactor,
    cookies,
    sessionId: extractSessionId(cookies),
    location,
  };
}

async function verify2FA(
  code: string,
  sessionCookies: string[],
  sessionId?: string,
): Promise<string[]> {
  const response = await request({
    url: `${AUTH_BASE_URL}${TWO_FACTOR_PATH}`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
      Cookie: buildCookieHeader(sessionCookies),
    },
    data: new URLSearchParams({
      code,
      ...(sessionId ? { session_id: sessionId } : {}),
    }).toString(),
    maxRedirects: 0,
    validateStatus: () => true,
  });

  const cookies = response.headers.getSetCookie?.() || [];

  if (response.status !== 200 && response.status !== 302) {
    throw new Error(`2FA verification failed (status=${response.status})`);
  }

  return cookies;
}

async function requestAuthProvider(): Promise<AuthProviderResponse> {
  const response = await request<AuthProviderResponse>({
    url: `${DOCPLANNER_BASE_URL}/api/auth/provider`,
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
    },
  });

  if (!response.data?.url_login) {
    throw new Error("Auth provider response missing url_login");
  }

  return response.data;
}

async function requestAuthorizationCode(ssoCookies: string[], provider: AuthProviderResponse) {
  const redirectUri = provider.redirect_uri || `${DOCPLANNER_BASE_URL}/#/`;
  const state = provider.state || "ssoLogin";

  const authUrl = new URL(provider.url_login);
  authUrl.searchParams.set("client_id", provider.client_id || "");
  authUrl.searchParams.set("response_type", provider.response_type || "code");
  authUrl.searchParams.set("scope", provider.scope || "client");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  const response = await request({
    url: authUrl.toString(),
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Cookie: buildCookieHeader(ssoCookies),
    },
    maxRedirects: 0,
    validateStatus: () => true,
  });

  const location = extractLocationHeader(response);
  const code = extractCodeFromLocation(location);

  if (!code) {
    throw new Error(
      `OAuth code not found (status=${response.status}, location=${location || "n/a"})`,
    );
  }

  return {
    code,
    redirectUri,
  };
}

async function exchangeCodeForWebToken(code: string, redirectUri: string): Promise<string> {
  const response = await request<WebTokenLoginResponse>({
    url: `${DOCPLANNER_BASE_URL}/api/account/webtoken-login`,
    method: "GET",
    params: {
      code,
      redirectUri,
    },
    headers: {
      Accept: "application/json, text/plain, */*",
    },
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    throw new Error(`webtoken-login failed (status=${response.status})`);
  }

  const token = response.data?.marketplaceToken?.token;
  if (!token) {
    throw new Error("webtoken-login response missing marketplace token");
  }

  const expiresAtRaw = response.data?.marketplaceToken?.expiresAt;
  const expiresInRaw = response.data?.marketplaceToken?.expires_in;

  let expiresAt = Date.now() + 24 * 3600_000;
  if (expiresAtRaw) {
    const parsed = Date.parse(expiresAtRaw);
    if (Number.isFinite(parsed)) {
      expiresAt = parsed;
    }
  } else if (typeof expiresInRaw === "number" && Number.isFinite(expiresInRaw)) {
    expiresAt = Date.now() + expiresInRaw * 1000;
  }

  cachedToken = {
    token,
    expiresAt,
  };

  return token;
}

/**
 * Get calendar access token (with caching)
 */
export async function getCalendarToken(twoFactorCode?: string): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 1 hour buffer)
  if (cachedToken && cachedToken.expiresAt > now + 3600_000) {
    return cachedToken.token;
  }

  const username = process.env.DOCTORALIA_CALENDAR_USERNAME;
  const password = process.env.DOCTORALIA_CALENDAR_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Doctoralia Calendar credentials not configured. Set DOCTORALIA_CALENDAR_USERNAME and DOCTORALIA_CALENDAR_PASSWORD.",
    );
  }

  const loginResult = await performLogin(username, password);

  let ssoCookies = loginResult.cookies;
  if (loginResult.requiresTwoFactor) {
    if (!twoFactorCode) {
      throw new Error(
        "2FA_REQUIRED: Two-factor authentication is enabled. Provide the 6-digit code.",
      );
    }

    const twoFactorCookies = await verify2FA(
      twoFactorCode,
      loginResult.cookies,
      loginResult.sessionId,
    );
    ssoCookies = mergeCookies(loginResult.cookies, twoFactorCookies);
  }

  const provider = await requestAuthProvider();
  const { code, redirectUri } = await requestAuthorizationCode(ssoCookies, provider);
  const token = await exchangeCodeForWebToken(code, redirectUri);

  console.log("[Doctoralia Calendar] Token obtained successfully via OAuth SSO");

  return token;
}

/**
 * Clear cached token (useful for re-authentication)
 */
export function clearCalendarTokenCache(): void {
  cachedToken = null;
}

/**
 * Get token if already cached (doesn't trigger new login)
 */
export function getCachedToken(): string | null {
  if (!cachedToken) {
    return null;
  }

  const now = Date.now();
  if (cachedToken.expiresAt <= now) {
    cachedToken = null;
    return null;
  }

  return cachedToken.token;
}
