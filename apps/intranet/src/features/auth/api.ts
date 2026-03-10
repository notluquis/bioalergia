import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import { authORPCClient, toAuthApiError } from "./orpc";
import {
  MfaSetupResponseSchema,
  PasskeyLoginOptionsResponseSchema,
  PasskeyRegistrationOptionsResponseSchema,
  StatusResponseSchema,
} from "./schemas";

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
  try {
    return StatusResponseSchema.parse(await authORPCClient.mfaDisable({}));
  } catch (error) {
    throw toAuthApiError(error);
  }
}

export async function enableMfa({ secret, token, userId }: MfaEnableParams) {
  void secret;
  void userId;

  try {
    return StatusResponseSchema.parse(await authORPCClient.mfaEnable({ token }));
  } catch (error) {
    throw toAuthApiError(error);
  }
}

// --- Passkey Registration ---

export async function fetchPasskeyLoginOptions() {
  try {
    return PasskeyLoginOptionsResponseSchema.parse(await authORPCClient.passkeyLoginOptions());
  } catch (error) {
    throw toAuthApiError(error);
  }
}

export async function fetchPasskeyRegistrationOptions() {
  try {
    return PasskeyRegistrationOptionsResponseSchema.parse(
      await authORPCClient.passkeyRegisterOptions(),
    );
  } catch (error) {
    throw toAuthApiError(error);
  }
}

export async function removePasskey() {
  try {
    return StatusResponseSchema.parse(await authORPCClient.passkeyRemove({}));
  } catch (error) {
    throw toAuthApiError(error);
  }
}

export async function setupMfa() {
  try {
    return MfaSetupResponseSchema.parse(await authORPCClient.mfaSetup({}));
  } catch (error) {
    throw toAuthApiError(error);
  }
}

export async function verifyPasskeyRegistration({ body, challenge }: PasskeyVerifyParams) {
  try {
    return StatusResponseSchema.parse(
      await authORPCClient.passkeyRegisterVerify({
        body: body as Record<string, unknown>,
        challenge,
      }),
    );
  } catch (error) {
    throw toAuthApiError(error);
  }
}
