import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const currentDir = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(currentDir, "../../.env") });
loadDotenv({ path: resolve(currentDir, "../../../../.env"), override: false });

const AUTH_BASE_URL = process.env.DOCTORALIA_CALENDAR_AUTH_BASE_URL || "https://l.doctoralia.cl";
const AUTH_BOOTSTRAP_PATH = process.env.DOCTORALIA_CALENDAR_AUTH_BOOTSTRAP_PATH || "/";
const LOGIN_PATH = process.env.DOCTORALIA_CALENDAR_LOGIN_PATH || "/login/check";
const DOCPLANNER_BASE_URL =
  process.env.DOCTORALIA_CALENDAR_DOCPLANNER_BASE_URL || "https://docplanner.doctoralia.cl";
const USER_AGENT =
  process.env.DOCTORALIA_CALENDAR_USER_AGENT ||
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.3 Safari/605.1.15";
const ACCEPT_LANGUAGE = process.env.DOCTORALIA_CALENDAR_ACCEPT_LANGUAGE || "es-CL,es;q=0.9";

type AuthProviderResponse = {
  url_login: string;
  client_id?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  redirect_uri?: string;
};

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

function parseSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  const native = withGetSetCookie.getSetCookie?.();
  if (native && native.length > 0) {
    return native;
  }
  const single = headers.get("set-cookie");
  if (!single) {
    return [];
  }
  return single
    .split(/,(?=\s*[^;,=\s]+=[^;,]+)/g)
    .map((value) => value.trim())
    .filter(Boolean);
}

function safeLocation(location: string) {
  try {
    const url = new URL(location, DOCPLANNER_BASE_URL);
    return {
      raw: location || "n/a",
      host: url.host,
      path: url.pathname,
      hasCode: Boolean(url.searchParams.get("code")),
    };
  } catch {
    return {
      raw: location || "n/a",
      host: "invalid",
      path: "invalid",
      hasCode: false,
    };
  }
}

async function requestManualRedirect(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("User-Agent", USER_AGENT);
  headers.set("Accept-Language", ACCEPT_LANGUAGE);

  return fetch(url, {
    ...init,
    headers,
    redirect: "manual",
  });
}

function printStep(step: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ step, ...details }, null, 2));
}

async function main() {
  const username = process.env.DOCTORALIA_CALENDAR_USERNAME;
  const password = process.env.DOCTORALIA_CALENDAR_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Missing credentials. Set DOCTORALIA_CALENDAR_USERNAME and DOCTORALIA_CALENDAR_PASSWORD.",
    );
  }

  const bootstrapResponse = await requestManualRedirect(`${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`, {
    method: "GET",
  });
  const bootstrapCookies = parseSetCookies(bootstrapResponse.headers);
  printStep("bootstrap", {
    status: bootstrapResponse.status,
    location: safeLocation(bootstrapResponse.headers.get("location") || ""),
    setCookieCount: bootstrapCookies.length,
    cookies: bootstrapCookies.map(cookieName),
  });

  const loginResponse = await requestManualRedirect(`${AUTH_BASE_URL}${LOGIN_PATH}`, {
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
  const loginCookies = parseSetCookies(loginResponse.headers);
  const mergedCookies = mergeCookies(bootstrapCookies, loginCookies);
  const loginLocation = loginResponse.headers.get("location") || "";
  printStep("login", {
    status: loginResponse.status,
    location: safeLocation(loginLocation),
    setCookieCount: loginCookies.length,
    cookies: loginCookies.map(cookieName),
  });

  const ssoCheck = await requestManualRedirect(`${AUTH_BASE_URL}${AUTH_BOOTSTRAP_PATH}`, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Cookie: buildCookieHeader(mergedCookies),
    },
  });
  const ssoHtml = await ssoCheck.text();
  const hasLoginForm =
    ssoHtml.includes('id="login-form"') ||
    ssoHtml.includes('name="_username"') ||
    ssoHtml.includes("route_login");
  printStep("sso-session-check", {
    status: ssoCheck.status,
    hasLoginForm,
  });

  const providerResponse = await requestManualRedirect(`${DOCPLANNER_BASE_URL}/api/auth/provider`, {
    method: "GET",
    headers: { Accept: "application/json, text/plain, */*" },
  });
  const providerJson = (await providerResponse.json()) as AuthProviderResponse;
  printStep("provider", {
    status: providerResponse.status,
    url_login_host: safeLocation(providerJson.url_login).host,
    hasClientId: Boolean(providerJson.client_id),
    hasState: Boolean(providerJson.state),
    hasRedirectUri: Boolean(providerJson.redirect_uri),
  });

  const authUrl = new URL(providerJson.url_login);
  authUrl.searchParams.set("client_id", providerJson.client_id || "");
  authUrl.searchParams.set("response_type", providerJson.response_type || "code");
  authUrl.searchParams.set("scope", providerJson.scope || "client");
  authUrl.searchParams.set("state", providerJson.state || "ssoLogin");
  authUrl.searchParams.set(
    "redirect_uri",
    providerJson.redirect_uri || `${DOCPLANNER_BASE_URL}/#/`,
  );

  const oauthResponse = await requestManualRedirect(authUrl.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: `${DOCPLANNER_BASE_URL}/`,
      Cookie: buildCookieHeader(mergedCookies),
    },
  });
  const oauthLocation = oauthResponse.headers.get("location") || "";
  const oauthLocationData = safeLocation(oauthLocation);
  printStep("oauth-authorize", {
    status: oauthResponse.status,
    location: oauthLocationData,
  });

  if (oauthLocationData.hasCode) {
    const url = new URL(oauthLocation, DOCPLANNER_BASE_URL);
    const code = url.searchParams.get("code") || "";
    const redirectUri = providerJson.redirect_uri || `${DOCPLANNER_BASE_URL}/#/`;
    const webtokenUrl = new URL(`${DOCPLANNER_BASE_URL}/api/account/webtoken-login`);
    webtokenUrl.searchParams.set("code", code);
    webtokenUrl.searchParams.set("redirectUri", redirectUri);

    const webtokenResponse = await requestManualRedirect(webtokenUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json, text/plain, */*" },
    });
    const body = await webtokenResponse.text();
    printStep("webtoken-login", {
      status: webtokenResponse.status,
      bodyPreview: body.slice(0, 200),
    });
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        step: "error",
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
