// SuperJSON-encoded oRPC link. Mirrors apps/intranet/src/features/calendar/orpc.ts
// because the api ships `SuperJSONRPCHandler` (encodes payloads as
// `{ json, meta }`) — a plain @orpc/client/fetch RPCLink would send raw
// JSON and the server rejects with "Input validation failed" since the
// `.json` envelope is missing.
//
// CSRF double-submit cookie is handled here too: every request mirrors
// `csrf_token` cookie into `X-CSRF-Token` header so csrfDoubleSubmit
// middleware accepts it.

import type { ClientContext } from "@orpc/client";
import { ErrorEvent, mapEventIterator, toORPCError } from "@orpc/client";
import type { LinkFetchClientOptions } from "@orpc/client/fetch";
import { LinkFetchClient } from "@orpc/client/fetch";
import type {
  StandardLinkOptions,
  StandardRPCLinkCodecOptions,
  StandardRPCSerializer,
} from "@orpc/client/standard";
import { StandardLink, StandardRPCLinkCodec } from "@orpc/client/standard";
import { isAsyncIteratorObject } from "@orpc/shared";
import superjson from "superjson";

function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
  return m ? decodeURIComponent(m[1] as string) : null;
}

async function orpcFetch(
  request: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const csrf = readCsrfCookie();
  const headers = new Headers(init?.headers);
  if (csrf) headers.set("X-CSRF-Token", csrf);
  const first = await fetch(request, { ...init, headers, credentials: "include" });
  if (first.status !== 403 || csrf) return first;
  // Cold-start: api just issued the cookie in this 403 response — retry once.
  const csrfNow = readCsrfCookie();
  if (!csrfNow) return first;
  const retryHeaders = new Headers(init?.headers);
  retryHeaders.set("X-CSRF-Token", csrfNow);
  return fetch(request, { ...init, headers: retryHeaders, credentials: "include" });
}

class SuperJSONSerializer implements Pick<StandardRPCSerializer, keyof StandardRPCSerializer> {
  serialize(data: unknown): object {
    if (isAsyncIteratorObject(data as object)) {
      return mapEventIterator(data as AsyncIterator<unknown, unknown, unknown>, {
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
    if (isAsyncIteratorObject(data as object)) {
      return mapEventIterator(data as AsyncIterator<unknown, unknown, unknown>, {
        value: async (value) =>
          superjson.deserialize(value as Parameters<typeof superjson.deserialize>[0]),
        error: async (error) => error,
      });
    }
    return superjson.deserialize(data as Parameters<typeof superjson.deserialize>[0]);
  }
}

interface SuperJSONLinkOptions<T extends ClientContext>
  extends LinkFetchClientOptions<T>,
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

export const siteSuperJSONLink = new SuperJSONLink({
  fetch: orpcFetch,
  url: () => window.location.origin,
});
