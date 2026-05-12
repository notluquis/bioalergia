import { authORPCClient, toAuthApiError } from "./orpc";
import {
  MfaSetupResponseSchema,
  PasskeyLoginOptionsResponseSchema,
  PasskeyRegistrationOptionsResponseSchema,
  StatusResponseSchema,
  type PasskeyLoginOptions,
  type PasskeyRegistrationOptions,
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

export type PasskeyOptionsResponse = {
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

export type PasskeyLoginResult =
  | { type: "success"; options: PasskeyLoginOptions }
  | { type: "error"; status: "error"; message?: string };

export type PasskeyRegistrationResult =
  | { type: "success"; options: PasskeyRegistrationOptions }
  | { type: "error"; status: "error"; message?: string };

export async function fetchPasskeyLoginOptions(): Promise<PasskeyLoginResult> {
  try {
    const result = PasskeyLoginOptionsResponseSchema.parse(
      await authORPCClient.passkeyLoginOptions()
    );
    if ("status" in result && result.status === "error") {
      // Discriminate between error and success responses
      return { type: "error", status: "error", message: result.message };
    }
    return { type: "success", options: result as PasskeyLoginOptions };
  } catch (error) {
    throw toAuthApiError(error);
  }
}

export async function fetchPasskeyRegistrationOptions(): Promise<PasskeyRegistrationResult> {
  try {
    const result = PasskeyRegistrationOptionsResponseSchema.parse(
      await authORPCClient.passkeyRegisterOptions()
    );
    if ("status" in result && result.status === "error") {
      // Discriminate between error and success responses
      return { type: "error", status: "error", message: result.message };
    }
    return { type: "success", options: result as PasskeyRegistrationOptions };
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
      })
    );
  } catch (error) {
    throw toAuthApiError(error);
  }
}
