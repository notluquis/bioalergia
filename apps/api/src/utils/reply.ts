import { Context } from "hono";
import superjson from "superjson";

export const reply = (c: Context, data: any, status = 200) => {
  const serialized = superjson.serialize(data);
  return c.json(serialized, status as any);
};
