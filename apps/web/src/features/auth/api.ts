import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";

import { apiClient } from "@/lib/apiClient";

export interface MfaEnableParams {
  secret?: string;
  token: string;
  userId?: number;
}

export interface MfaSetupResponse {
  message?: string;
  qrCodeUrl: string;
  secret: string;
  status: string;
}

// --- MFA ---

export type PasskeyLoginOptions = PublicKeyCredentialCreationOptionsJSON & {
  challenge: string;
};

export type PasskeyOptionsResponse = PublicKeyCredentialCreationOptionsJSON & {
  message?: string;
  status?: string;
};

export interface PasskeyVerifyParams {
  body: unknown;
  challenge: string;
}

export async function disableMfa() {
  return apiClient.post<{ status: string }>("/api/auth/mfa/disable", {});
}

export async function enableMfa({ secret, token, userId }: MfaEnableParams) {
  return apiClient.post<{ message?: string; status: string }>("/api/auth/mfa/enable", {
    secret,
    token,
    userId,
  });
}

// --- Passkey Registration ---

export async function fetchPasskeyLoginOptions() {
  return apiClient.get<PasskeyLoginOptions>("/api/auth/passkey/login/options");
}

export async function fetchPasskeyRegistrationOptions() {
  return apiClient.get<PasskeyOptionsResponse>("/api/auth/passkey/register/options");
}

export async function removePasskey() {
  // Use delete method if the API supports it, component used delete
  return apiClient.delete<{ message?: string; status: string }>("/api/auth/passkey/remove");
}

export async function setupMfa() {
  return apiClient.post<MfaSetupResponse>("/api/auth/mfa/setup", {});
}

export async function verifyPasskeyRegistration({ body, challenge }: PasskeyVerifyParams) {
  return apiClient.post<{ message?: string; status: string }>("/api/auth/passkey/register/verify", {
    body,
    challenge,
  });
}
