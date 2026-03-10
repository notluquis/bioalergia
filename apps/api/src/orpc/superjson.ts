import {
  createORPCErrorFromJson,
  ErrorEvent,
  isORPCErrorJson,
  mapEventIterator,
  toORPCError,
} from "@orpc/client";
import type { StandardRPCSerializer } from "@orpc/client/standard";
import type { Context, Router } from "@orpc/server";
import type { FetchHandlerOptions } from "@orpc/server/fetch";
import { FetchHandler } from "@orpc/server/fetch";
import { StrictGetMethodPlugin } from "@orpc/server/plugins";
import type { StandardHandlerOptions } from "@orpc/server/standard";
import { StandardHandler, StandardRPCCodec, StandardRPCMatcher } from "@orpc/server/standard";
import { isAsyncIteratorObject } from "@orpc/shared";
import type { Context as HonoContext } from "hono";
import { configureSuperjson } from "../lib/superjson-config";

const superjson = configureSuperjson();

export class SuperJSONSerializer
  implements Pick<StandardRPCSerializer, keyof StandardRPCSerializer>
{
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
            error.data as Parameters<typeof superjson.deserialize>[0],
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

export interface SuperJSONRPCHandlerOptions<T extends Context>
  extends FetchHandlerOptions<T>,
    Omit<StandardHandlerOptions<T>, "plugins"> {
  strictGetMethodPluginEnabled?: boolean;
}

export class SuperJSONRPCHandler<T extends Context> extends FetchHandler<T> {
  constructor(
    router: Router<Record<never, never>, T>,
    options: NoInfer<SuperJSONRPCHandlerOptions<T>> = {},
  ) {
    options.plugins ??= [];

    if (options.strictGetMethodPluginEnabled ?? true) {
      options.plugins.push(new StrictGetMethodPlugin());
    }

    const serializer = new SuperJSONSerializer();
    const matcher = new StandardRPCMatcher();
    const codec = new StandardRPCCodec(serializer as StandardRPCSerializer);

    super(new StandardHandler(router, matcher, codec, options), options);
  }
}

const BODY_PARSER_METHODS = new Set(["arrayBuffer", "blob", "formData", "json", "text"] as const);

type BodyParserMethod = typeof BODY_PARSER_METHODS extends Set<infer T> ? T : never;

export function createHonoORPCRequest(c: HonoContext): Request {
  return new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]();
      }

      return Reflect.get(target, prop, target);
    },
  });
}
