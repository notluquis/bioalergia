import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { reply } from "./reply";

interface ErrorReplyOptions {
  code?: string;
  details?: unknown;
}

function defaultCode(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status >= 500) return "INTERNAL_ERROR";
  return "REQUEST_ERROR";
}

export function errorReply(
  c: Context,
  status: ContentfulStatusCode,
  message: string,
  options?: ErrorReplyOptions,
) {
  return reply(
    c,
    {
      status: "error",
      code: options?.code ?? defaultCode(status),
      message,
      ...(options?.details === undefined ? {} : { details: options.details }),
    },
    status,
  );
}
