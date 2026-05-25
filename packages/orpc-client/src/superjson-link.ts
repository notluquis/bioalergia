// SuperJSON-encoded oRPC link. Required because api routers use
// SuperJSONRPCHandler which expects `{ json, meta }` envelope.
// Pairs with apps/api/src/orpc/superjson.ts on the server side.

import type { ClientContext } from "@orpc/client";
import {
  createORPCErrorFromJson,
  ErrorEvent,
  isORPCErrorJson,
  mapEventIterator,
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
import type { SuperJSON as SuperJSONInstance } from "superjson";
import defaultSuperjsonClass from "superjson";

// The default export of `superjson` is a singleton instance but the
// types ship it as the class — cast to the instance type once here.
const defaultSuperjson = defaultSuperjsonClass as unknown as SuperJSONInstance;
type SuperJSON = SuperJSONInstance;

export class SuperJSONSerializer implements Pick<
  StandardRPCSerializer,
  keyof StandardRPCSerializer
> {
  private readonly superjson: SuperJSON;

  constructor(instance: SuperJSON = defaultSuperjson) {
    this.superjson = instance;
  }

  serialize(data: unknown): object {
    if (isAsyncIteratorObject(data as object)) {
      return mapEventIterator(data as AsyncIterator<unknown, unknown, unknown>, {
        value: async (value: unknown) => this.superjson.serialize(value),
        error: async (error) =>
          new ErrorEvent({
            data: this.superjson.serialize(toORPCError(error).toJSON()),
            cause: error,
          }),
      });
    }
    return this.superjson.serialize(data);
  }

  deserialize(data: unknown): unknown {
    if (isAsyncIteratorObject(data as object)) {
      return mapEventIterator(data as AsyncIterator<unknown, unknown, unknown>, {
        value: async (value) =>
          this.superjson.deserialize(value as Parameters<SuperJSON["deserialize"]>[0]),
        error: async (error) => {
          if (!(error instanceof ErrorEvent)) return error;
          const decoded = this.superjson.deserialize(
            error.data as Parameters<SuperJSON["deserialize"]>[0]
          );
          if (isORPCErrorJson(decoded)) {
            return createORPCErrorFromJson(decoded, { cause: error });
          }
          return new ErrorEvent({ data: decoded, cause: error });
        },
      });
    }
    return this.superjson.deserialize(data as Parameters<SuperJSON["deserialize"]>[0]);
  }
}

interface SuperJSONLinkOptions<T extends ClientContext>
  extends
    LinkFetchClientOptions<T>,
    Omit<StandardLinkOptions<T>, "plugins">,
    StandardRPCLinkCodecOptions<T> {
  superjson?: SuperJSON;
}

export class SuperJSONLink<T extends ClientContext> extends StandardLink<T> {
  constructor(options: SuperJSONLinkOptions<T>) {
    const linkClient = new LinkFetchClient(options);
    const serializer = new SuperJSONSerializer(options.superjson);
    const linkCodec = new StandardRPCLinkCodec(
      serializer as unknown as StandardRPCSerializer,
      options
    );
    super(linkCodec, linkClient, options);
  }
}
