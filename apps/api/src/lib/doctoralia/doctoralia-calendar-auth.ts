/**
 * Doctoralia Calendar Authentication
 *
 * Handles login flow for Docplanner calendar:
 * 1. Login with credentials
 * 2. Handle 2FA if enabled
 * 3. Extract and cache bearer token
 */

import { request } from "gaxios";

const LOGIN_URL = "https://l.doctoralia.cl";

// Regex patterns
const PHPSESSID_REGEX = /PHPSESSID=([^;]+)/;
const MKPL_AUTH_BEARER_REGEX = /mkplAuth=bearer%20([^;]+)/;
const MKPL_AUTH_REGEX = /mkplAuth=([^;]+)/;
const TWO_FACTOR_LOCATION_REGEX = /\/2fa(?:\?|$)/i;

// Token cache with expiration (24 hours default)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Check if calendar credentials are configured
 */
export function isCalendarAuthConfigured(): boolean {
  return Boolean(
    process.env.DOCTORALIA_CALENDAR_USERNAME && process.env.DOCTORALIA_CALENDAR_PASSWORD,
  );
}

/**
 * Perform login to Doctoralia calendar
 */
async function performLogin(
  username: string,
  password: string,
): Promise<{
  requiresTwoFactor: boolean;
  cookies: string[];
  sessionId?: string;
}> {
  try {
    const response = await request<{ requires_2fa?: boolean; token?: string }>({
      url: `${LOGIN_URL}/login`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
      },
      data: new URLSearchParams({
        username,
        password,
      }).toString(),
      // Important: keep the original response to preserve Set-Cookie and Location.
      // Following redirects can hide auth cookies required for mkplAuth extraction.
      maxRedirects: 0,
      validateStatus: () => true, // Don't throw on any status
    });

    const cookies = response.headers.getSetCookie?.() || [];
    const locationHeader =
      response.headers.get?.("location") ||
      (response.headers as unknown as { location?: string }).location ||
      "";
    const tokenFromCookies = extractTokenFromCookies(cookies);

    // Direct token in response payload (rare)
    if (response.data?.token) {
      return {
        requiresTwoFactor: false,
        cookies,
      };
    }

    // Redirect flow: only require 2FA when redirect target indicates it.
    if (response.status === 302) {
      if (tokenFromCookies) {
        return {
          requiresTwoFactor: false,
          cookies,
        };
      }

      const requiresTwoFactor =
        Boolean(response.data?.requires_2fa) || TWO_FACTOR_LOCATION_REGEX.test(locationHeader);

      return {
        requiresTwoFactor,
        cookies,
        sessionId: extractSessionId(cookies),
      };
    }

    // Non-redirect successful login with auth cookie
    if (tokenFromCookies) {
      return {
        requiresTwoFactor: false,
        cookies,
      };
    }

    throw new Error(
      `Login failed: No token received (status=${response.status}, location=${locationHeader || "n/a"}, cookies=${cookies.length})`,
    );
  } catch (error) {
    console.error("[Doctoralia Calendar] Login error:", error);
    throw new Error(`Login failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Verify 2FA code
 */
async function verify2FA(
  code: string,
  sessionCookies: string[],
  sessionId?: string,
): Promise<string[]> {
  try {
    const response = await request({
      url: `${LOGIN_URL}/2fa`,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
        Cookie: sessionCookies.join("; "),
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
      throw new Error("2FA verification failed");
    }

    return cookies;
  } catch (error) {
    console.error("[Doctoralia Calendar] 2FA verification error:", error);
    throw new Error(
      `2FA verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Extract session ID from cookies
 */
function extractSessionId(cookies: string[]): string | undefined {
  for (const cookie of cookies) {
    const match = cookie.match(PHPSESSID_REGEX);
    if (match) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Extract bearer token from cookies
 */
function extractTokenFromCookies(cookies: string[]): string | null {
  for (const cookie of cookies) {
    // Look for mkplAuth cookie
    const match = cookie.match(MKPL_AUTH_BEARER_REGEX);
    if (match) {
      return decodeURIComponent(match[1]);
    }

    // Alternative: direct bearer format
    const directMatch = cookie.match(MKPL_AUTH_REGEX);
    if (directMatch) {
      const value = decodeURIComponent(directMatch[1]);
      if (value.startsWith("bearer ")) {
        return value.substring(7);
      }
      return value;
    }
  }

  return null;
}

/**
 * Get calendar access token (with caching)
 *
 * Flow:
 * 1. Check cache
 * 2. Perform login
 * 3. Handle 2FA if needed
 * 4. Extract and cache token
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

  try {
    // Step 1: Login
    const loginResult = await performLogin(username, password);

    let finalCookies = loginResult.cookies;

    // Step 2: Handle 2FA if required
    if (loginResult.requiresTwoFactor) {
      if (!twoFactorCode) {
        throw new Error(
          "2FA_REQUIRED: Two-factor authentication is enabled. Provide the 6-digit code.",
        );
      }

      const tfaCookies = await verify2FA(twoFactorCode, loginResult.cookies, loginResult.sessionId);
      finalCookies = [...loginResult.cookies, ...tfaCookies];
    }

    // Step 3: Extract token
    const token = extractTokenFromCookies(finalCookies);

    if (!token) {
      throw new Error("Failed to extract token from authentication response");
    }

    // Cache token for 24 hours
    cachedToken = {
      token,
      expiresAt: now + 24 * 3600_000,
    };

    console.log("[Doctoralia Calendar] Token obtained successfully");

    return token;
  } catch (error) {
    console.error("[Doctoralia Calendar] Authentication error:", error);
    throw error;
  }
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
