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
  status?: string;
  reason: string;
  message: string;
  domain: string;
  metadata?: Record<string, string>;
  retryAfterSeconds?: number;
  originalError: Error;
}

/**
 * Custom error class for Google API errors with human-readable messages.
 */
export class GoogleApiError extends Error {
  code: number;
  status?: string;
  reason: string;
  domain: string;
  metadata?: Record<string, string>;
  retryAfterSeconds?: number;
  originalError: Error;

  constructor(info: GoogleApiErrorInfo) {
    super(info.message);
    this.name = "GoogleApiError";
    this.code = info.code;
    this.status = info.status;
    this.reason = info.reason;
    this.domain = info.domain;
    this.metadata = info.metadata;
    this.retryAfterSeconds = info.retryAfterSeconds;
    this.originalError = info.originalError;
  }
}

export type GoogleRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitter?: number;
  idempotent?: boolean;
  retryOnCodes?: readonly number[];
  retryOnReasons?: readonly string[];
  retryOnStatuses?: readonly string[];
  context?: string;
};

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
  status?: string;
  reason: string;
  domain: string;
  rawMessage: string;
  metadata?: Record<string, string>;
  retryAfterSeconds?: number;
} {
  const code = error.response?.status ?? error.code ?? 500;
  const headers = error.response?.headers as Record<string, unknown> | undefined;
  const retryAfterSeconds = parseRetryAfterSeconds(headers?.["retry-after"]);
  const data = error.response?.data as {
    error?: {
      status?: string;
      message?: string;
      errors?: Array<{ reason?: string; domain?: string; message?: string }>;
      details?: Array<{
        ["@type"]?: string;
        reason?: string;
        domain?: string;
        metadata?: Record<string, string>;
      }>;
    };
  };

  const aipInfo = extractAip193Info(data?.error);
  if (aipInfo) {
    return {
      code: Number(code),
      status: data?.error?.status ?? aipInfo.status,
      reason: aipInfo.reason ?? "unknown",
      domain: aipInfo.domain ?? "global",
      rawMessage: aipInfo.message ?? data?.error?.message ?? error.message,
      metadata: aipInfo.metadata,
      retryAfterSeconds,
    };
  }

  const firstError = data?.error?.errors?.[0];
  const reason = firstError?.reason ?? "unknown";
  const domain = firstError?.domain ?? "global";
  const rawMessage = firstError?.message ?? data?.error?.message ?? error.message;

  return {
    code: Number(code),
    status: data?.error?.status,
    reason,
    domain,
    rawMessage,
    retryAfterSeconds,
  };
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

function isRetryableError(error: GoogleApiError, options: Required<GoogleRetryOptions>): boolean {
  if (!options.idempotent) {
    return false;
  }

  if (options.retryOnCodes.includes(error.code)) {
    return true;
  }

  if (options.retryOnReasons.includes(error.reason)) {
    return true;
  }

  if (error.status && options.retryOnStatuses.includes(error.status)) {
    return true;
  }

  return false;
}

function computeRetryDelayMs(
  attempt: number,
  error: GoogleApiError,
  options: Required<GoogleRetryOptions>,
): number {
  const baseDelay = options.baseDelayMs * 2 ** attempt;
  const cappedDelay = Math.min(baseDelay, options.maxDelayMs);
  const headerDelay = error.retryAfterSeconds
    ? Math.max(cappedDelay, error.retryAfterSeconds * 1000)
    : cappedDelay;
  const jitterFactor = 1 + (Math.random() * 2 - 1) * options.jitter;
  return Math.max(0, Math.floor(headerDelay * jitterFactor));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryGoogleCall<T>(
  operation: () => Promise<T>,
  options: GoogleRetryOptions = {},
): Promise<T> {
  const resolved: Required<GoogleRetryOptions> = {
    maxAttempts: options.maxAttempts ?? 4,
    baseDelayMs: options.baseDelayMs ?? 500,
    maxDelayMs: options.maxDelayMs ?? 10_000,
    jitter: options.jitter ?? 0.2,
    idempotent: options.idempotent ?? true,
    retryOnCodes: options.retryOnCodes ?? [429, 500, 502, 503, 504],
    retryOnReasons: options.retryOnReasons ?? [
      "rateLimitExceeded",
      "userRateLimitExceeded",
      "quotaExceeded",
      "backendError",
    ],
    retryOnStatuses: options.retryOnStatuses ?? [
      "RESOURCE_EXHAUSTED",
      "UNAVAILABLE",
      "INTERNAL",
      "ABORTED",
      "DEADLINE_EXCEEDED",
    ],
    context: options.context ?? "",
  };

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err) {
      const parsed = parseGoogleError(err);
      const shouldRetry = isRetryableError(parsed, resolved);
      const isLastAttempt = attempt >= resolved.maxAttempts - 1;

      if (!shouldRetry || isLastAttempt) {
        if (resolved.context) {
          parsed.message = `${resolved.context}: ${parsed.message}`;
        }
        throw parsed;
      }

      const delayMs = computeRetryDelayMs(attempt, parsed, resolved);
      attempt += 1;
      await sleep(delayMs);
    }
  }
}

function extractAip193Info(
  error:
    | {
        status?: string;
        message?: string;
        details?: Array<{
          ["@type"]?: string;
          reason?: string;
          domain?: string;
          metadata?: Record<string, string>;
        }>;
      }
    | undefined,
): {
  status?: string;
  message?: string;
  reason?: string;
  domain?: string;
  metadata?: Record<string, string>;
} | null {
  if (!error?.details || !Array.isArray(error.details)) {
    return null;
  }

  const errorInfo = error.details.find(
    (detail) => detail?.["@type"] === "type.googleapis.com/google.rpc.ErrorInfo",
  );
  if (!errorInfo) {
    return null;
  }

  return {
    status: error.status,
    message: error.message,
    reason: errorInfo.reason,
    domain: errorInfo.domain,
    metadata: errorInfo.metadata,
  };
}

function parseRetryAfterSeconds(value: unknown): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.floor(seconds));
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    const deltaMs = date.getTime() - Date.now();
    return Math.max(0, Math.ceil(deltaMs / 1000));
  }

  return undefined;
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
    const { code, status, reason, domain, rawMessage, metadata, retryAfterSeconds } =
      extractGaxiosDetails(error);
    const message = getHumanMessage(code, reason, rawMessage);

    return new GoogleApiError({
      code,
      status,
      reason,
      domain,
      message,
      metadata,
      retryAfterSeconds,
      originalError: error,
    });
  }

  if (error instanceof Error) {
    return new GoogleApiError({
      code: 500,
      status: undefined,
      reason: "unknown",
      domain: "application",
      message: error.message,
      metadata: undefined,
      retryAfterSeconds: undefined,
      originalError: error,
    });
  }

  return new GoogleApiError({
    code: 500,
    status: undefined,
    reason: "unknown",
    domain: "application",
    message: String(error),
    metadata: undefined,
    retryAfterSeconds: undefined,
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
