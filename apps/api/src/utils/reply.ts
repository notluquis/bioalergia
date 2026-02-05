import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import superjson from "superjson";

export const reply = <T = unknown>(c: Context, data: T, status: ContentfulStatusCode = 200) => {
  const serialized = superjson.serialize(data);
  return c.json(serialized, status);
};
