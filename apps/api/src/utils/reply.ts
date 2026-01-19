import type { Context } from "hono";
import superjson from "superjson";

// biome-ignore lint/suspicious/noExplicitAny: generic reply helper
export const reply = (c: Context, data: any, status = 200) => {
  const serialized = superjson.serialize(data);
  // biome-ignore lint/suspicious/noExplicitAny: hono types
  return c.json(serialized, status as any);
};
