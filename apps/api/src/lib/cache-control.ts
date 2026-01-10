import { createMiddleware } from "hono/factory";

/**
 * Middleware to set Cache-Control headers.
 * Defaults to 'private' to ensure sensitive user data is not cached by shared proxies.
 *
 * @param seconds - Duration in seconds for max-age
 * @param directive - Cache directive (default: 'private')
 */
export const cacheControl = (
  seconds: number,
  directive: "private" | "public" = "private"
) => {
  return createMiddleware(async (c, next) => {
    await next();

    // Only cache successful GET requests
    if (c.req.method === "GET" && c.res.status === 200) {
      c.header("Cache-Control", `${directive}, max-age=${seconds}`);
    }
  });
};
