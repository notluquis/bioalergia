import { kysely } from "@finanzas/db";
import { sql } from "kysely";

export type DebugAudience = "debug-cli" | "debug-playwright";

export type DebugScope = {
  action: string;
  subject: string;
};

export type StoredDebugToken = {
  audience: DebugAudience;
  expiresAt: Date;
  id: number;
  issuedByUserId: number;
  jti: string;
  reason: string;
  scopes: DebugScope[];
  targetUserId: number;
  usedAt: Date | null;
};

type StoredDebugTokenRow = {
  audience: DebugAudience;
  expiresAt: Date;
  id: number;
  issuedByUserId: number;
  jti: string;
  reason: string;
  scopes: unknown;
  targetUserId: number;
  usedAt: Date | null;
};

function normalizeDebugScopes(scopes: DebugScope[]) {
  return scopes
    .map((scope) => ({
      action: scope.action.trim(),
      subject: scope.subject.trim(),
    }))
    .filter((scope) => scope.action.length > 0 && scope.subject.length > 0)
    .sort((left, right) =>
      `${left.subject}:${left.action}`.localeCompare(`${right.subject}:${right.action}`)
    );
}

function parseScopes(value: unknown): DebugScope[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const action = "action" in entry ? entry.action : undefined;
      const subject = "subject" in entry ? entry.subject : undefined;
      if (typeof action !== "string" || typeof subject !== "string") {
        return null;
      }
      return { action, subject };
    })
    .filter((entry): entry is DebugScope => entry !== null);
}

function mapStoredToken(row: StoredDebugTokenRow): StoredDebugToken {
  return {
    audience: row.audience,
    expiresAt: row.expiresAt,
    id: row.id,
    issuedByUserId: row.issuedByUserId,
    jti: row.jti,
    reason: row.reason,
    scopes: parseScopes(row.scopes),
    targetUserId: row.targetUserId,
    usedAt: row.usedAt,
  };
}

export function ensureDebugTokenSupportEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.ENABLE_DEBUG_TOKENS === "true") {
    return;
  }
  throw new Error("Debug tokens are disabled in production");
}

export async function createDebugTokenRecord(params: {
  audience: DebugAudience;
  expiresAt: Date;
  issuedByUserId: number;
  jti: string;
  reason: string;
  scopes: DebugScope[];
  targetUserId: number;
}) {
  const normalizedScopes = normalizeDebugScopes(params.scopes);

  await sql`
    INSERT INTO public.debug_tokens (
      jti,
      issued_by_user_id,
      target_user_id,
      audience,
      reason,
      scopes,
      expires_at
    )
    VALUES (
      ${params.jti},
      ${params.issuedByUserId},
      ${params.targetUserId},
      ${params.audience},
      ${params.reason},
      ${JSON.stringify(normalizedScopes)}::jsonb,
      ${params.expiresAt.toISOString()}
    )
  `.execute(kysely);
}

export async function consumeDebugTokenRecord(jti: string): Promise<null | StoredDebugToken> {
  const result = await sql<StoredDebugTokenRow>`
    UPDATE public.debug_tokens
    SET used_at = NOW()
    WHERE jti = ${jti}
      AND used_at IS NULL
      AND expires_at > NOW()
    RETURNING
      id,
      jti,
      issued_by_user_id AS "issuedByUserId",
      target_user_id AS "targetUserId",
      audience,
      reason,
      scopes,
      expires_at AS "expiresAt",
      used_at AS "usedAt"
  `.execute(kysely);

  const row = result.rows[0];
  return row ? mapStoredToken(row) : null;
}
