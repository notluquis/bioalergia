import { db } from "@finanzas/db";
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

  await db.debugToken.create({
    data: {
      jti: params.jti,
      issuedByUserId: params.issuedByUserId,
      targetUserId: params.targetUserId,
      audience: params.audience,
      reason: params.reason,
      // Json field: pass the value, ZenStack serializes (no JSON.stringify).
      scopes: normalizedScopes as never,
      expiresAt: params.expiresAt,
    },
  });
}

export async function consumeDebugTokenRecord(jti: string): Promise<null | StoredDebugToken> {
  // Atomic conditional consume: only flip used_at when still unused AND
  // unexpired, in a single UPDATE ... RETURNING (guards the double-consume race).
  // ORM `update` matches only the unique field and `updateMany` returns no rows,
  // so the typed query builder ($qb) is the right tool to keep exact semantics.
  const row = await db.$qb
    .updateTable("DebugToken")
    .set({ usedAt: sql`NOW()` })
    .where("jti", "=", jti)
    .where("usedAt", "is", null)
    .where(sql<boolean>`expires_at > NOW()`)
    .returning([
      "id",
      "jti",
      "issuedByUserId",
      "targetUserId",
      "audience",
      "reason",
      "scopes",
      "expiresAt",
      "usedAt",
    ])
    .executeTakeFirst();

  // $qb types timestamptz columns as string; pg returns Date at runtime (same as
  // the prior raw sql<StoredDebugTokenRow>). Cast through unknown to the row shape
  // mapStoredToken expects — identical pattern to google-calendar-queries.ts.
  return row ? mapStoredToken(row as unknown as StoredDebugTokenRow) : null;
}
