/**
 * Google API Error Handler
 *
 * Centralized error parsing and human-readable messages for Google APIs.
 * Handles GaxiosError from googleapis and provides clean error messages.
 */

import { GaxiosError } from "gaxios";

/**
 * Parsed Google API error with clean, actionable information.
 */
export interface GoogleApiErrorInfo {
  code: number;
  reason: string;
  message: string;
  domain: string;
  originalError: Error;
}

/**
 * Custom error class for Google API errors with human-readable messages.
 */
export class GoogleApiError extends Error {
  code: number;
  reason: string;
  domain: string;
  originalError: Error;

  constructor(info: GoogleApiErrorInfo) {
    super(info.message);
    this.name = "GoogleApiError";
    this.code = info.code;
    this.reason = info.reason;
    this.domain = info.domain;
    this.originalError = info.originalError;
  }
}

/**
 * Human-readable error messages in Spanish.
 */
const ERROR_MESSAGES: Record<number, Record<string, string> | string> = {
  400: {
    badRequest: "Solicitud inválida",
    invalidSharingRequest: "No se puede compartir con esta cuenta",
    invalid_grant:
      "Token de actualización inválido o expirado. Ejecuta 'npm run google:auth' nuevamente.",
    default: "Error en la solicitud",
  },
  401: "Autenticación fallida. Por favor, re-autoriza la cuenta de Google.",
  403: {
    storageQuotaExceeded: "Cuota de almacenamiento de Google Drive excedida",
    userRateLimitExceeded: "Límite de solicitudes excedido. Intenta en unos minutos.",
    rateLimitExceeded: "Límite de solicitudes excedido. Intenta en unos minutos.",
    forbidden: "Sin permisos para esta acción",
    insufficientFilePermissions: "Sin permisos para acceder a este archivo",
    sharingRateLimitExceeded: "Demasiadas operaciones de compartir. Espera un momento.",
    // Service account specific error
    default: "Sin permisos o cuota insuficiente",
  },
  404: "Archivo o carpeta no encontrado en Google Drive",
  409: "Conflicto: el archivo ya existe o está siendo modificado",
  429: "Demasiadas solicitudes. Espera un momento antes de reintentar.",
  500: "Error interno de Google. Intenta nuevamente.",
  503: "Google Drive temporalmente no disponible. Intenta en unos minutos.",
};

/**
 * Extracts error details from a GaxiosError response.
 */
function extractGaxiosDetails(error: GaxiosError): {
  code: number;
  reason: string;
  domain: string;
  rawMessage: string;
} {
  const code = error.response?.status ?? error.code ?? 500;
  const data = error.response?.data as {
    error?: {
      errors?: Array<{ reason?: string; domain?: string; message?: string }>;
      message?: string;
    };
  };

  const firstError = data?.error?.errors?.[0];
  const reason = firstError?.reason ?? "unknown";
  const domain = firstError?.domain ?? "global";
  const rawMessage = firstError?.message ?? data?.error?.message ?? error.message;

  return { code: Number(code), reason, domain, rawMessage };
}

/**
 * Gets a human-readable message for the error.
 */
function getHumanMessage(code: number, reason: string, rawMessage: string): string {
  const codeMessages = ERROR_MESSAGES[code];

  if (typeof codeMessages === "string") {
    return codeMessages;
  }

  if (typeof codeMessages === "object") {
    return codeMessages[reason] ?? codeMessages.default ?? rawMessage;
  }

  // Special handling for common raw messages
  if (rawMessage.includes("Service Accounts do not have storage quota")) {
    return "Las cuentas de servicio no tienen cuota de almacenamiento. Se requiere OAuth con cuenta personal.";
  }

  return rawMessage || `Error de Google API (código ${code})`;
}

/**
 * Parses any error into a clean GoogleApiError.
 * Handles GaxiosError, standard Error, and unknown types.
 */
export function parseGoogleError(error: unknown): GoogleApiError {
  if (error instanceof GoogleApiError) {
    return error;
  }

  if (error instanceof GaxiosError) {
    const { code, reason, domain, rawMessage } = extractGaxiosDetails(error);
    const message = getHumanMessage(code, reason, rawMessage);

    return new GoogleApiError({
      code,
      reason,
      domain,
      message,
      originalError: error,
    });
  }

  if (error instanceof Error) {
    return new GoogleApiError({
      code: 500,
      reason: "unknown",
      domain: "application",
      message: error.message,
      originalError: error,
    });
  }

  return new GoogleApiError({
    code: 500,
    reason: "unknown",
    domain: "application",
    message: String(error),
    originalError: new Error(String(error)),
  });
}

/**
 * Wraps an async Google API call with proper error handling.
 * Returns a Result-like object for clean error handling.
 */
export async function safeGoogleCall<T>(
  operation: () => Promise<T>,
  context?: string,
): Promise<{ ok: true; data: T } | { ok: false; error: GoogleApiError }> {
  try {
    const data = await operation();
    return { ok: true, data };
  } catch (err) {
    const error = parseGoogleError(err);
    if (context) {
      error.message = `${context}: ${error.message}`;
    }
    return { ok: false, error };
  }
}
