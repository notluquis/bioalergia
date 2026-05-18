import type { AuthSession } from "./auth.ts";
import { getSessionUser, hasPermission } from "./auth.ts";
import { AppError } from "./app-error.ts";
import { createMiddleware } from "hono/factory";
import type { MiddlewareHandler } from "hono";

export type LegacyRouteVariables = {
  user: AuthSession;
};

type LegacyEnv = {
  Variables: LegacyRouteVariables;
};

export const requireSession: MiddlewareHandler<LegacyEnv> = createMiddleware<LegacyEnv>(async (c, next) => {
  const user = await getSessionUser(c);

  if (!user) {
    throw new AppError(401, {
      code: "UNAUTHORIZED",
      message: "Unauthorized",
    });
  }

  c.set("user", user);
  await next();
});

export const requirePermission = (action: string, subject: string): MiddlewareHandler<LegacyEnv> =>
  createMiddleware<LegacyEnv>(async (c, next) => {
    const user = c.get("user");

    if (!(await hasPermission(user, action, subject))) {
      throw new AppError(403, {
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    await next();
  });

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
