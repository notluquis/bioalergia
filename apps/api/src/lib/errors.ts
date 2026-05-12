// Typed domain errors carrying a stable `kind` discriminator + an HTTP
// status hint. Service-layer code throws these instead of generic
// `Error` so the oRPC layer (and the legacy REST routes) can map them
// to user-meaningful HTTP responses (409 CONFLICT, 404 NOT_FOUND, etc.)
// without leaking server stack traces or surfacing them as 500s.
//
// The status mapping mirrors the oRPC error codes (`@orpc/server`
// ORPCError) so the conversion at the boundary is mechanical.

export type DomainErrorKind =
  | "CONFLICT"
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "UNPROCESSABLE_ENTITY";

const STATUS_BY_KIND: Record<DomainErrorKind, number> = {
  CONFLICT: 409,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  UNPROCESSABLE_ENTITY: 422,
};

export class DomainError extends Error {
  readonly kind: DomainErrorKind;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(kind: DomainErrorKind, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DomainError";
    this.kind = kind;
    this.status = STATUS_BY_KIND[kind];
    this.details = details;
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError;
}
