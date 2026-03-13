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
import type { LinkFetchClientOptions } from "@orpc/client/fetch";
import { LinkFetchClient } from "@orpc/client/fetch";
import type {
  StandardLinkOptions,
  StandardRPCLinkCodecOptions,
  StandardRPCSerializer,
} from "@orpc/client/standard";
import { StandardLink, StandardRPCLinkCodec } from "@orpc/client/standard";
import { isAsyncIteratorObject } from "@orpc/shared";
import { ApiError } from "@/lib/api-client";
import type { UnsafeORPCClient } from "@/lib/orpc-client";
import { configureSuperjson } from "@/lib/superjson-config";

const superjson = configureSuperjson();

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
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: () => window.location.origin,
});

export const calendarORPCClient = createORPCClient(calendarORPCLink, {
  path: ["api", "orpc", "calendar", "rpc"],
}) as unknown as UnsafeORPCClient;

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
