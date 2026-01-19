import type { Context } from "hono";

export function logEvent(tag: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level: "info", tag, ...details }));
}

export function logWarn(tag: string, details: Record<string, unknown> = {}) {
  console.warn(JSON.stringify({ level: "warn", tag, ...details }));
}

export function logError(tag: string, error: unknown, details: Record<string, unknown> = {}) {
  const errMessage = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ level: "error", tag, error: errMessage, ...details }));
}

export const logger = {
  info: (obj: object, msg?: string) => console.log(JSON.stringify({ level: "info", msg, ...obj })),
  warn: (obj: object, msg?: string) => console.warn(JSON.stringify({ level: "warn", msg, ...obj })),
  error: (obj: object, msg?: string) =>
    console.error(JSON.stringify({ level: "error", msg, ...obj })),
  child: () => logger, // Dummy child
};

export function requestContext(c: Context | any, extra: Record<string, unknown> = {}) {
  // Try to extract user from context if available (depends on middleware)
  const user = c.get?.("user") || null;

  return {
    method: c.req?.method,
    path: c.req?.path,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    ...extra,
  };
}
