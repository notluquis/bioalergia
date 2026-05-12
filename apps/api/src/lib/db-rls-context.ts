import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import type { Context, MiddlewareHandler } from "hono";

// Per-request Postgres RLS user-context binding. Sets the GUC
// `app.current_user_id` (read by the LEAKPROOF helper
// current_app_user() inside the policies declared by migration
// 20260512012000_rls_patients_clinical) so RLS can scope row visibility
// to the authenticated user.
//
// Disabled by default: gated by env DB_RLS_ENABLED. The migration only
// declares policies; tables are not ENABLE ROW LEVEL SECURITY'd until
// the operator flips both this env AND the per-table ALTER. See
// docs/security/rls.md for the full activation checklist.
//
// Why a separate middleware (not inside the auth resolver): the GUC
// has to be set on the same connection that runs the queries. We use
// `set_config(..., true)` which is local-to-tx, so an explicit
// transaction wrapper is required. Most app code currently runs
// queries on auto-commit, so we set the GUC at session level (false)
// when the connection is checked out from the pool — see notes below.
//
// Refs:
//   - PostgreSQL §9.27.1 set_config / current_setting
//   - PostgreSQL §5.9 Row Security Policies

const ENABLED = process.env.DB_RLS_ENABLED === "1" || process.env.DB_RLS_ENABLED === "true";

export function isRlsEnabled(): boolean {
  return ENABLED;
}

export async function setRequestUserContext(userId: number | null): Promise<void> {
  if (!ENABLED) return;
  // Session-level set_config (third arg = false) so the value persists
  // for any auto-commit queries within this request. The pool reuses
  // physical connections, so the next request that lands on the same
  // connection MUST also call this — never fall through with a stale
  // GUC value.
  await sql`SELECT set_config('app.current_user_id', ${userId == null ? "" : String(userId)}, false)`.execute(
    kysely
  );
}

/**
 * Hono middleware that binds the authenticated user's id into the
 * Postgres GUC for every downstream query. Mount AFTER the auth
 * resolver so c.get('sessionUser') is populated.
 *
 * No-op when DB_RLS_ENABLED is unset — the policies still exist in
 * the DB but no table currently has FORCE ROW LEVEL SECURITY, so the
 * absence of the GUC has no runtime effect.
 */
export function rlsContextMiddleware(): MiddlewareHandler {
  return async (c: Context, next) => {
    if (!ENABLED) return next();
    const session = c.get("sessionUser") as { id?: number } | null | undefined;
    try {
      await setRequestUserContext(session?.id ?? null);
    } catch {
      // Best-effort: a GUC set failure must not block the request.
      // Worst case the request runs without RLS context and the
      // policies (when enabled) deny the rows — that's a hard fail
      // visible to the user, not a silent privilege escalation.
    }
    return next();
  };
}
