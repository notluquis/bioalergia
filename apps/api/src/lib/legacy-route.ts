import type { AuthSession } from "../auth";
import { getSessionUser, hasPermission } from "../auth";
import { AppError } from "./app-error";
import { createMiddleware } from "hono/factory";

export type LegacyRouteVariables = {
  user: AuthSession;
};

type LegacyEnv = {
  Variables: LegacyRouteVariables;
};

export const requireSession = createMiddleware<LegacyEnv>(async (c, next) => {
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

export const requirePermission = (action: string, subject: string) =>
  createMiddleware<LegacyEnv>(async (c, next) => {
    const user = c.get("user");

    if (!(await hasPermission(user.id, action, subject))) {
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
