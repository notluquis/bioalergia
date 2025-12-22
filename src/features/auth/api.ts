import { apiClient } from "@/lib/apiClient";
import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";

export type PasskeyLoginOptions = PublicKeyCredentialCreationOptionsJSON & {
  challenge: string;
};

export async function fetchPasskeyLoginOptions() {
  return apiClient.get<PasskeyLoginOptions>("/api/auth/passkey/login/options");
}

// --- MFA ---

export interface MfaSetupResponse {
  status: string;
  secret: string;
  qrCodeUrl: string;
  message?: string;
}

export async function setupMfa() {
  return apiClient.post<MfaSetupResponse>("/api/auth/mfa/setup", {});
}

export interface MfaEnableParams {
  token: string;
  userId?: number;
}

export async function enableMfa({ token, userId }: MfaEnableParams) {
  return apiClient.post<{ status: string; message?: string }>("/api/auth/mfa/enable", {
    token,
    userId,
  });
}

export async function disableMfa() {
  return apiClient.post<{ status: string }>("/api/auth/mfa/disable", {});
}

// --- Passkey Registration ---

export type PasskeyOptionsResponse = PublicKeyCredentialCreationOptionsJSON & {
  status?: string;
  message?: string;
};

export async function fetchPasskeyRegistrationOptions() {
  return apiClient.get<PasskeyOptionsResponse>("/api/auth/passkey/register/options");
}

export interface PasskeyVerifyParams {
  body: unknown;
  challenge: string;
}

export async function verifyPasskeyRegistration({ body, challenge }: PasskeyVerifyParams) {
  return apiClient.post<{ status: string; message?: string }>("/api/auth/passkey/register/verify", {
    body,
    challenge,
  });
}

export async function removePasskey() {
  // Use delete method if the API supports it, component used delete
  return apiClient.delete<{ status: string; message?: string }>("/api/auth/passkey/remove");
}
