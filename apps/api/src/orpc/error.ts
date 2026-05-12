import { ORPCError } from "@orpc/server";
import { AppError } from "../lib/app-error.ts";
import { DomainError } from "../lib/errors.ts";
import { GoogleApiError } from "../lib/google/google-errors.ts";

function mapHttpStatusToORPCCode(status: number): string {
  if (status === 400 || status === 422) {
    return "BAD_REQUEST";
  }
  if (status === 401) {
    return "UNAUTHORIZED";
  }
  if (status === 403) {
    return "FORBIDDEN";
  }
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status === 409) {
    return "CONFLICT";
  }
  if (status === 429) {
    return "RATE_LIMITED";
  }
  return "INTERNAL_SERVER_ERROR";
}

function normalizeErrorStatus(status: number): number {
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return status;
  }
  if (status === 408 || status === 409 || status === 422 || status === 429) {
    return status;
  }
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return status;
  }
  return 500;
}

export function toORPCError(error: unknown): ORPCError<string, unknown> {
  if (error instanceof ORPCError) {
    return error;
  }

  if (error instanceof DomainError) {
    return new ORPCError(mapHttpStatusToORPCCode(error.status), {
      data: error.details,
      message: error.message,
      status: error.status,
    });
  }

  if (error instanceof AppError) {
    const status = normalizeErrorStatus(error.status);

    return new ORPCError(mapHttpStatusToORPCCode(status), {
      data: {
        appCode: error.code,
        ...(error.expose && error.details !== undefined ? { details: error.details } : {}),
      },
      message: error.expose ? error.message : "Internal server error",
      status,
    });
  }

  if (error instanceof GoogleApiError) {
    const status = normalizeErrorStatus(error.code);

    return new ORPCError(mapHttpStatusToORPCCode(status), {
      data: {
        domain: error.domain,
        provider: "google-drive",
        reason: error.reason,
        ...(error.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: error.retryAfterSeconds }
          : {}),
      },
      message: error.message,
      status,
    });
  }

  if (error instanceof Error) {
    return new ORPCError("INTERNAL_SERVER_ERROR", {
      message: error.message || "Internal server error",
      status: 500,
    });
  }

  return new ORPCError("INTERNAL_SERVER_ERROR", {
    message: "Internal server error",
    status: 500,
  });
}
