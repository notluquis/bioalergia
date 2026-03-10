/**
 * SuperJSON Serialization for oRPC
 *
 * CRITICAL: oRPC's standard JSON handler cannot serialize:
 * ❌ Date objects (becomes invalid JSON)
 * ❌ BigInt values (exceeds Number.MAX_SAFE_INTEGER)
 * ❌ Decimal types (from Prisma/Zenstack)
 * ❌ Map/Set (not JSON serializable)
 *
 * This module provides SuperJSON serialization which handles all of above:
 * ✅ Date → ISO string (wire) → Date (client)
 * ✅ BigInt → string (wire) → BigInt (client)
 * ✅ Decimal → number (wire) → number (client)
 *
 * Zenstack v3 returns Date/BigInt/Decimal types, so this is ESSENTIAL.
 * Without it, endpoints like /events/job/:jobId will fail to serialize job.createdAt.
 *
 * See: docs/ORPC_ZENSTACK_ARCHITECTURE.md for more context.
 */

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

/**
 * Custom serializer that wraps SuperJSON library.
 * Handles Date, BigInt, Decimal, and other special types.
 */
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

/**
 * oRPC HTTP handler with SuperJSON serialization.
 *
 * Extends FetchHandler to provide:
 * - SuperJSON codec for Date/BigInt/Decimal serialization
 * - StandardRPCMatcher for routing
 * - StrictGetMethodPlugin for HTTP GET enforcement
 *
 * This is the HTTP transport layer for all oRPC routers.
 * When a POST request comes to /api/orpc/calendar/rpc/..., it routes
 * through this handler which deserializes input (SuperJSON), calls
 * the procedure, and serializes output (SuperJSON).
 *
 * Example usage:
 * ```typescript
 * const handler = new SuperJSONRPCHandler(myRouter, {
 *   interceptors: [onError((err) => logError(err))]
 * })
 *
 * // In Hono middleware:
 * app.use('/api/orpc/my-feature/rpc/*', async (c, next) => {
 *   const { matched, response } = await handler.handle(
 *     createHonoORPCRequest(c),
 *     { prefix: '/api/orpc/my-feature/rpc', context: { hono: c } }
 *   )
 *   if (matched) return c.newResponse(response.body, response)
 *   await next()
 * })
 * ```
 */
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
