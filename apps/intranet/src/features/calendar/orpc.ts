import type { ClientContext } from "@orpc/client";
import {
  createORPCClient,
  createORPCErrorFromJson,
  ErrorEvent,
  isORPCErrorJson,
  mapEventIterator,
  ORPCError,
  toORPCError,
} from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import type { LinkFetchClientOptions } from "@orpc/client/fetch";
import { LinkFetchClient } from "@orpc/client/fetch";
import type {
  StandardLinkOptions,
  StandardRPCLinkCodecOptions,
  StandardRPCSerializer,
} from "@orpc/client/standard";
import { StandardLink, StandardRPCLinkCodec } from "@orpc/client/standard";
import { isAsyncIteratorObject } from "@orpc/shared";
import type { CalendarContract } from "@finanzas/orpc-contracts/calendar";
import { ApiError } from "@/lib/api-client";
import { configureSuperjson } from "@/lib/superjson-config";

const superjson = configureSuperjson();

const VALID_ORPC_ERROR_STATUSES = new Set([
  400, 401, 402, 403, 404, 408, 409, 412, 413, 415, 422, 429, 500, 501, 502, 503, 504,
]);

function normalizeORPCErrorStatus(status: number): number {
  return VALID_ORPC_ERROR_STATUSES.has(status) ? status : 500;
}

function defaultErrorMessageByStatus(status: number): string {
  if (status === 401) {
    return "Tu sesión expiró. Vuelve a iniciar sesión.";
  }
  if (status === 403) {
    return "No tienes permisos para realizar esta acción.";
  }
  if (status === 404) {
    return "Recurso no encontrado.";
  }
  if (status === 429) {
    return "Demasiadas solicitudes. Intenta nuevamente en un momento.";
  }
  if (status >= 500) {
    return "Ocurrió un error interno del servidor.";
  }
  return "Ocurrió un error inesperado.";
}

function trimErrorText(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

function toStructuredORPCErrorResponse(response: Response, rawBody: string): Response {
  const normalizedStatus = normalizeORPCErrorStatus(response.status);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  let parsedBody: unknown = undefined;

  if (contentType.includes("application/json")) {
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      parsedBody = undefined;
    }
  }

  if (isORPCErrorJson(parsedBody) && normalizedStatus === response.status) {
    return response;
  }

  const parsedMessage =
    parsedBody && typeof parsedBody === "object"
      ? (() => {
          const candidate = parsedBody as { error?: unknown; message?: unknown };
          if (typeof candidate.message === "string") {
            return candidate.message;
          }
          if (typeof candidate.error === "string") {
            return candidate.error;
          }
          return undefined;
        })()
      : undefined;

  const fallbackMessage =
    parsedMessage ?? trimErrorText(rawBody) ?? defaultErrorMessageByStatus(normalizedStatus);

  const errorJson = {
    code:
      normalizedStatus === 429
        ? "RATE_LIMITED"
        : normalizedStatus >= 500
          ? "INTERNAL_SERVER_ERROR"
          : "REQUEST_ERROR",
    data: {
      contentType: contentType || null,
      upstreamStatus: response.status,
    },
    message: fallbackMessage,
    status: normalizedStatus,
  };

  return new Response(JSON.stringify(errorJson), {
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    status: normalizedStatus,
    statusText: response.statusText,
  });
}

// Reads csrf_token from document.cookie. The server's
// csrf-double-submit middleware rejects state-changing requests whose
// X-CSRF-Token header doesn't match this cookie value. Cookie is not
// httpOnly so the SPA can mirror it here.
function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

async function orpcFetch(request: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const csrf = readCsrfCookie();
  const headers = new Headers(init?.headers);
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const response = await fetch(request, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.ok) {
    return response;
  }

  let rawBody = "";
  try {
    rawBody = await response.clone().text();
  } catch {
    rawBody = "";
  }

  return toStructuredORPCErrorResponse(response, rawBody);
}

class SuperJSONSerializer implements Pick<StandardRPCSerializer, keyof StandardRPCSerializer> {
  serialize(data: unknown): object {
    if (isAsyncIteratorObject(data)) {
      return mapEventIterator(data, {
        value: async (value: unknown) => superjson.serialize(value),
        error: async (error) =>
          new ErrorEvent({
            data: superjson.serialize(toORPCError(error).toJSON()),
            cause: error,
          }),
      });
    }

    return superjson.serialize(data);
  }

  deserialize(data: unknown): unknown {
    if (isAsyncIteratorObject(data)) {
      return mapEventIterator(data, {
        value: async (value) => superjson.deserialize(value),
        error: async (error) => {
          if (!(error instanceof ErrorEvent)) {
            return error;
          }

          const deserialized = superjson.deserialize(
            error.data as Parameters<typeof superjson.deserialize>[0]
          );

          if (isORPCErrorJson(deserialized)) {
            return createORPCErrorFromJson(deserialized, { cause: error });
          }

          return new ErrorEvent({
            data: deserialized,
            cause: error,
          });
        },
      });
    }

    return superjson.deserialize(data as Parameters<typeof superjson.deserialize>[0]);
  }
}

interface SuperJSONLinkOptions<T extends ClientContext>
  extends
    LinkFetchClientOptions<T>,
    Omit<StandardLinkOptions<T>, "plugins">,
    StandardRPCLinkCodecOptions<T> {}

export class SuperJSONLink<T extends ClientContext> extends StandardLink<T> {
  constructor(options: SuperJSONLinkOptions<T>) {
    const linkClient = new LinkFetchClient(options);
    const serializer = new SuperJSONSerializer();
    const linkCodec = new StandardRPCLinkCodec(serializer as StandardRPCSerializer, options);

    super(linkCodec, linkClient, options);
  }
}

const calendarORPCLink = new SuperJSONLink({
  fetch: orpcFetch,
  url: () => window.location.origin,
});

export type CalendarORPCClient = ContractRouterClient<CalendarContract>;

export const calendarORPCClient = createORPCClient<CalendarORPCClient>(calendarORPCLink, {
  path: ["api", "orpc", "calendar", "rpc"],
});

export function toCalendarApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ORPCError) {
    return new ApiError(error.message, error.status, error.data);
  }

  if (error instanceof Error) {
    return new ApiError(error.message, 500);
  }

  return new ApiError("Error inesperado", 500, error);
}
