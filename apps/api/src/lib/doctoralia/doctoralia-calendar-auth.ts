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
import { logEvent, logWarn } from "../logger";

const AUTH_BASE_URL = process.env.DOCTORALIA_CALENDAR_AUTH_BASE_URL || "https://l.doctoralia.cl";
const AUTH_BOOTSTRAP_PATH = process.env.DOCTORALIA_CALENDAR_AUTH_BOOTSTRAP_PATH || "/";
const LOGIN_PATH = process.env.DOCTORALIA_CALENDAR_LOGIN_PATH || "/login/check";
const TWO_FACTOR_PATH = process.env.DOCTORALIA_CALENDAR_2FA_PATH || "/2fa";
const DOCPLANNER_BASE_URL =
  process.env.DOCTORALIA_CALENDAR_DOCPLANNER_BASE_URL || "https://docplanner.doctoralia.cl";
const BROWSER_USER_AGENT =
  process.env.DOCTORALIA_CALENDAR_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15";
const BROWSER_ACCEPT_LANGUAGE = process.env.DOCTORALIA_CALENDAR_ACCEPT_LANGUAGE || "es-CL,es;q=0.9";

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

type OAuthCandidate = {
  state?: string;
  redirectUri?: string;
  responseType?: string;
  scope?: string;
};

type OAuthAttemptResult = {
  code: string | null;
  status: number;
  location: string;
  redirectUri: string;
};

function toSafeLocationDetails(location: string) {
  if (!location) {
    return { locationHost: "n/a", locationPath: "n/a" };
  }

  try {
    const parsed = new URL(location, DOCPLANNER_BASE_URL);
    return { locationHost: parsed.host, locationPath: parsed.pathname };
  } catch {
    return { locationHost: "invalid", locationPath: "invalid" };
  }
}

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

function getSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };

  const cookies = withGetSetCookie.getSetCookie?.();
  if (cookies && cookies.length > 0) {
    return cookies;
  }

  const singleCookie = headers.get("set-cookie");
  if (!singleCookie) {
    return [];
  }

  // Fallback for runtimes without Headers.getSetCookie():
  // split combined Set-Cookie header on cookie boundaries.
  return singleCookie
    .split(/,(?=\s*[^;,=\s]+=[^;,]+)/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

async function requestManualRedirect(input: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", BROWSER_USER_AGENT);
  }
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", BROWSER_ACCEPT_LANGUAGE);
  }

  return fetch(input, {
    ...init,
    headers,
    redirect: "manual",
  });
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
  const bootstrapResponse = await requestManualRedirect(`${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`, {
    method: "GET",
  });
  const bootstrapCookies = getSetCookies(bootstrapResponse.headers);

  const response = await requestManualRedirect(`${AUTH_BASE_URL}${LOGIN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
      Origin: AUTH_BASE_URL,
      Referer: `${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`,
      ...(bootstrapCookies.length > 0 ? { Cookie: buildCookieHeader(bootstrapCookies) } : {}),
    },
    body: new URLSearchParams({
      _username: username,
      _password: password,
      username,
      password,
    }).toString(),
  });

  const responseCookies = getSetCookies(response.headers);
  const cookies = mergeCookies(bootstrapCookies, responseCookies);
  const location = extractLocationHeader(response);
  const locationDetails = toSafeLocationDetails(location);
  logEvent("doctoralia.calendar.auth.login.response", {
    status: response.status,
    setCookieCount: responseCookies.length,
    ...locationDetails,
  });

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

async function assertSsoSessionIsAuthenticated(cookies: string[]) {
  const response = await fetch(`${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Cookie: buildCookieHeader(cookies),
    },
    redirect: "manual",
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return;
  }

  const html = await response.text();
  const hasLoginForm =
    html.includes('id="login-form"') ||
    html.includes('name="_username"') ||
    html.includes("route_login");

  if (hasLoginForm) {
    logWarn("doctoralia.calendar.auth.session.not_authenticated", {
      status: response.status,
    });
    throw new Error(
      "SSO login did not establish an authenticated session (check credentials, CAPTCHA/2FA, or anti-bot restrictions).",
    );
  }

  logEvent("doctoralia.calendar.auth.session.authenticated", {
    status: response.status,
  });
}

async function verify2FA(
  code: string,
  sessionCookies: string[],
  sessionId?: string,
): Promise<string[]> {
  const response = await requestManualRedirect(`${AUTH_BASE_URL}${TWO_FACTOR_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json, text/plain, */*",
      Origin: AUTH_BASE_URL,
      Referer: `${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`,
      Cookie: buildCookieHeader(sessionCookies),
    },
    body: new URLSearchParams({
      code,
      ...(sessionId ? { session_id: sessionId } : {}),
    }).toString(),
  });

  const cookies = getSetCookies(response.headers);

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

  logEvent("doctoralia.calendar.auth.provider.loaded", {
    hasClientId: Boolean(response.data.client_id),
    hasRedirectUri: Boolean(response.data.redirect_uri),
    hasState: Boolean(response.data.state),
  });

  return response.data;
}

async function requestAuthorizationCode(ssoCookies: string[], provider: AuthProviderResponse) {
  const candidates = buildOAuthCandidates(provider);

  let lastStatus = 0;
  let lastLocation = "";
  for (const [index, candidate] of candidates.entries()) {
    const result = await tryOAuthCandidate(ssoCookies, provider, candidate);
    const locationDetails = toSafeLocationDetails(result.location);
    logEvent("doctoralia.calendar.auth.oauth.attempt", {
      attempt: index + 1,
      status: result.status,
      hasCode: Boolean(result.code),
      ...locationDetails,
    });
    if (result.code) {
      return {
        code: result.code,
        redirectUri: result.redirectUri,
      };
    }

    lastStatus = result.status;
    lastLocation = result.location;
  }

  logWarn("doctoralia.calendar.auth.oauth.failed", {
    attempts: candidates.length,
    status: lastStatus,
    ...toSafeLocationDetails(lastLocation),
  });
  throw new Error(`OAuth code not found (status=${lastStatus}, location=${lastLocation || "n/a"})`);
}

function buildOAuthCandidates(provider: AuthProviderResponse): OAuthCandidate[] {
  return [
    {
      responseType: provider.response_type || "code",
      scope: provider.scope || "client",
      state: provider.state || undefined,
      redirectUri: provider.redirect_uri || undefined,
    },
    {
      responseType: provider.response_type || "code",
      scope: provider.scope || "client",
      state: "ssoLogin",
      redirectUri: `${DOCPLANNER_BASE_URL}/`,
    },
    {
      responseType: provider.response_type || "code",
      scope: provider.scope || "client",
      state: "ssoLogin",
      redirectUri: `${DOCPLANNER_BASE_URL}/#/`,
    },
  ];
}

async function tryOAuthCandidate(
  ssoCookies: string[],
  provider: AuthProviderResponse,
  candidate: OAuthCandidate,
): Promise<OAuthAttemptResult> {
  const authUrl = new URL(provider.url_login);
  authUrl.searchParams.set("client_id", provider.client_id || "");
  authUrl.searchParams.set("response_type", candidate.responseType || "code");
  authUrl.searchParams.set("scope", candidate.scope || "client");
  if (candidate.state) {
    authUrl.searchParams.set("state", candidate.state);
  }
  if (candidate.redirectUri) {
    authUrl.searchParams.set("redirect_uri", candidate.redirectUri);
  }

  const response = await requestManualRedirect(authUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: `${DOCPLANNER_BASE_URL}/`,
      Cookie: buildCookieHeader(ssoCookies),
    },
  });

  const location = extractLocationHeader(response);
  const code = extractCodeFromLocation(location);
  return {
    code,
    status: response.status,
    location,
    redirectUri: candidate.redirectUri || `${DOCPLANNER_BASE_URL}/#/`,
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
    logEvent("doctoralia.calendar.auth.cache.hit", {});
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
  logEvent("doctoralia.calendar.auth.login.completed", {
    requiresTwoFactor: loginResult.requiresTwoFactor,
  });

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
    logEvent("doctoralia.calendar.auth.2fa.completed", {
      hasSessionId: Boolean(loginResult.sessionId),
    });
  }

  await assertSsoSessionIsAuthenticated(ssoCookies);

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
