/**
 * Haulmer JWT Authentication
 * Keycloak password grant flow
 */

import { request } from "gaxios";

export interface HaulmerConfig {
  email: string;
  password: string;
  rut: string;
}

export interface HaulmerAuthResponse {
  jwtToken: string;
  workspaceId?: string;
  issuedAt: Date;
  expiresAt: Date;
}

interface KeycloakTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
}

/**
 * Get JWT from Haulmer Keycloak using password grant
 */
export async function captureHaulmerJWT(config: HaulmerConfig): Promise<HaulmerAuthResponse> {
  const TOKEN_URL =
    "https://accounts.haulmer.com/realms/haulmer-users/protocol/openid-connect/token";

  console.log(`[Haulmer Auth] Requesting JWT for ${config.email}`);

  try {
    const response = await request<KeycloakTokenResponse>({
      url: TOKEN_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      data: new URLSearchParams({
        grant_type: "password",
        username: config.email,
        password: config.password,
        client_id: "workspace-prod",
      }).toString(),
      timeout: 30000,
    });

    if (response.status !== 200 || !response.data?.access_token) {
      throw new Error(`Invalid response: ${response.status}`);
    }

    const { access_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    console.log(`[Haulmer Auth] JWT obtained, expires in ${expires_in}s`);

    return {
      jwtToken: access_token,
      workspaceId: undefined,
      issuedAt: new Date(),
      expiresAt,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Haulmer Auth] Failed: ${msg}`);
    throw new Error(`Haulmer auth failed: ${msg}`);
  }
}

export function isJWTExpired(expiresAt: Date): boolean {
  const buffer = 5 * 60 * 1000; // 5-minute safety buffer
  return Date.now() > expiresAt.getTime() - buffer;
}
