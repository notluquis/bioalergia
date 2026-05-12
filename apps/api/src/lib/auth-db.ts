import { authDb } from "@finanzas/db";
import type { Context } from "hono";
import { ORPCError } from "@orpc/server";
import { createAuthContext, getSessionUser, type AuthSession } from "../auth.ts";

// Per-request bound ZenStack client. `authDb.$setAuth(subject)` returns
// a wrapped query API that rewrites every read/write to honor the
// `@@allow` / `@@deny` rules declared in packages/db/zenstack/schema.zmodel.
//
// Why this helper exists rather than calling $setAuth inline:
//
//   1. Centralizes the auth subject shape so every router uses the
//      same canonical AuthSession → AuthContext mapping (createAuthContext).
//   2. Rejects unauthenticated callers with a typed ORPCError instead
//      of silently returning a wide-open client.
//   3. Documents the migration story (see docs/security/authdb-migration.md)
//      — new routers adopt this helper; legacy routers using `db` directly
//      stay functional and migrate one at a time.
//
// Usage inside an oRPC handler:
//
//     .handler(async ({ context }) => {
//       const xdb = await getAuthDbForContext(context.hono);
//       return xdb.patient.findMany({ where: { … } });
//     });
//
// Background jobs that have no user identity should keep using the raw
// `db` export — there is no service-account subject in this codebase
// yet. Migrating a job to authDb requires either minting a service
// user or extending the policies to allow `auth() == null` paths
// explicitly (the current pattern in audit_logs).

export async function getAuthDbForContext(c: Context) {
  const session = await getSessionUser(c);
  return getAuthDbForSession(session);
}

export function getAuthDbForSession(session: AuthSession | null) {
  const subject = createAuthContext(session);
  if (!subject) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  return authDb.$setAuth(subject);
}
