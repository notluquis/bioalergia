import type { Context } from "hono";

function toSerializable(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue) =>
    typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
  );
}

export function logEvent(tag: string, details: Record<string, unknown> = {}) {
  console.log(toSerializable({ level: "info", tag, ...details }));
}

export function logWarn(tag: string, details: Record<string, unknown> = {}) {
  console.warn(toSerializable({ level: "warn", tag, ...details }));
}

export function logError(tag: string, error: unknown, details?: Record<string, unknown>): void;
export function logError(error: unknown, details?: Record<string, unknown>): void;
export function logError(
  tagOrError: string | unknown,
  errorOrDetails?: Record<string, unknown> | unknown,
  maybeDetails: Record<string, unknown> = {},
) {
  const tag = typeof tagOrError === "string" && arguments.length >= 3 ? tagOrError : "error";
  const error = tag === "error" ? tagOrError : errorOrDetails;
  const details =
    tag === "error"
      ? ((errorOrDetails as Record<string, unknown> | undefined) ?? {})
      : maybeDetails;
  const errMessage = error instanceof Error ? error.message : String(error);
  console.error(toSerializable({ level: "error", tag, error: errMessage, ...details }));
}

export const logger = {
  info: (obj: object, msg?: string) => console.log(toSerializable({ level: "info", msg, ...obj })),
  warn: (obj: object, msg?: string) => console.warn(toSerializable({ level: "warn", msg, ...obj })),
  error: (obj: object, msg?: string) =>
    console.error(toSerializable({ level: "error", msg, ...obj })),
  child: () => logger, // Dummy child
};

type RequestLikeContext = {
  get?: (key: string) => unknown;
  req?: {
    method?: string;
    path?: string;
  };
};

export function requestContext(
  c: Context | RequestLikeContext,
  extra: Record<string, unknown> = {},
) {
  // Try to extract user from context if available (depends on middleware)
  const maybeUser = c.get?.("user");
  const user =
    maybeUser && typeof maybeUser === "object"
      ? (maybeUser as { email?: string; id?: number | string })
      : null;

  return {
    method: c.req?.method,
    path: c.req?.path,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    ...extra,
  };
}
