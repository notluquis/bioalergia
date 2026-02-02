import type { Context } from "hono";
import superjson from "superjson";

export const reply = <T = unknown>(c: Context, data: T, status = 200) => {
  const serialized = superjson.serialize(data);
  return c.json(serialized, status);
};
