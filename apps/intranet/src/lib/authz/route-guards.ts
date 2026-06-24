import { redirect } from "@tanstack/react-router";

/**
 * Minimal shape of the `_authed` router context consumed by route guards.
 *
 * `_authed.tsx` injects `can: ability.can.bind(ability)` into every child
 * route's context (see `routes/_authed.tsx`). We type against just that method
 * so guards stay decoupled from the full `RouterContext` generic surface.
 */
interface GuardContext {
  can: (action: string, subject: string) => boolean;
}

interface RequirePermissionOptions {
  /** Redirect target when the permission check fails. Defaults to `"/"`. */
  redirectTo?: string;
}

/**
 * Builds a TanStack Router `beforeLoad` function that enforces a single
 * CASL permission, redirecting on failure.
 *
 * DRYs the repeated inline pattern across `routes/_authed/**`:
 *
 * ```ts
 * beforeLoad: ({ context }) => {
 *   if (!context.can("read", "Calendar")) {
 *     throw redirect({ to: "/" });
 *   }
 * }
 * ```
 *
 * becomes:
 *
 * ```ts
 * beforeLoad: requirePermission("read", "Calendar"),
 * ```
 *
 * Only use for routes whose `beforeLoad` does nothing but a single
 * permission-redirect. Routes that load data, run two-tier logic, or check
 * multiple permissions should keep their bespoke `beforeLoad`.
 */
export function requirePermission(
  action: string,
  subject: string,
  opts?: RequirePermissionOptions
) {
  return ({ context }: { context: GuardContext }): void => {
    if (!context.can(action, subject)) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({ to: opts?.redirectTo ?? "/" });
    }
  };
}
