/**
 * Doctoralia Core - OAuth2 Authentication
 *
 * Handles OAuth2 client credentials flow for Doctoralia API.
 * Domain defaults to Chile (doctoralia.cl) and can be overridden.
 */

import { request } from "gaxios";
import type { OAuth2TokenResponse } from "./doctoralia-types.js";

// Chile domain default; override with DOCTORALIA_DOMAIN if needed.
const DOCTORALIA_DOMAIN = process.env.DOCTORALIA_DOMAIN || "doctoralia.cl";
const TOKEN_URL = `https://www.${DOCTORALIA_DOMAIN}/oauth/v2/token`;

// Token cache with expiration
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Check if Doctoralia is configured
 */
export function isDoctoraliaConfigured(): boolean {
  return Boolean(process.env.DOCTORALIA_CLIENT_ID && process.env.DOCTORALIA_CLIENT_SECRET);
}

/**
 * Get OAuth2 access token (with caching)
 *
 * Uses client_credentials grant type as per Doctoralia API docs.
 * Token is cached and refreshed 60 seconds before expiration.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.DOCTORALIA_CLIENT_ID;
  const clientSecret = process.env.DOCTORALIA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Doctoralia OAuth2 credentials not configured. Set DOCTORALIA_CLIENT_ID and DOCTORALIA_CLIENT_SECRET.",
    );
  }

  try {
    const response = await request<OAuth2TokenResponse>({
      url: TOKEN_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    cachedToken = {
      token: response.data.access_token,
      expiresAt: now + response.data.expires_in * 1000,
    };

    console.log(`[Doctoralia] Token obtained, expires in ${response.data.expires_in}s`);

    return cachedToken.token;
  } catch (error) {
    console.error("[Doctoralia] Failed to obtain access token:", error);
    throw new Error("Failed to authenticate with Doctoralia API");
  }
}

/**
 * Clear cached token (useful for testing or re-authentication)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

/**
 * Get the Doctoralia domain
 */
export function getDoctoraliaDomain(): string {
  return DOCTORALIA_DOMAIN;
}
