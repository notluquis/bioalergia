import { kysely } from "@finanzas/db";
import { createHmac } from "node:crypto";
import { sql } from "kysely";

// Standalone verifier for the audit_logs HMAC chain. Mirrors the
// trigger function `audit_log_chain()` (migration 20260512010000) so
// the result here matches what Postgres computed at insert time.
//
// Returns the first row id whose entry_hash does not match the
// recomputed value, or null if the chain is intact end-to-end. Run
// this from a cron / nightly job and alert on any non-null result —
// it indicates either tampering or a divergent HMAC key.
//
// Usage:
//   const tampered = await verifyAuditChain();
//   if (tampered !== null) emitTamperingAlert(tampered);

const ZERO_HASH = Buffer.alloc(32);

function hmacKey(): Buffer {
  const raw = process.env.AUDIT_HMAC_KEY;
  if (!raw) {
    // Mirror the trigger's dev fallback: digest('audit-log-dev-' || db, 'sha256').
    // The DB name lookup must match what Postgres sees.
    throw new Error("AUDIT_HMAC_KEY env required to verify chain in production");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHmac("sha256", "fallback").update(raw).digest();
}

function rowDigest(prev: Buffer, row: AuditRow, key: Buffer): Buffer {
  const concat = Buffer.concat([
    prev,
    Buffer.from(row.occurredAt.toISOString().replace("T", " ").replace("Z", ""), "utf8"),
    Buffer.from(row.kind ?? "", "utf8"),
    Buffer.from(row.userId == null ? "" : String(row.userId), "utf8"),
    Buffer.from(row.actorLabel ?? "", "utf8"),
    Buffer.from(row.ip ?? "", "utf8"),
    Buffer.from(row.userAgent ?? "", "utf8"),
    Buffer.from(row.resource ?? "", "utf8"),
    Buffer.from(row.resourceId ?? "", "utf8"),
    Buffer.from(row.outcome ?? "", "utf8"),
    Buffer.from(row.message ?? "", "utf8"),
    Buffer.from(row.metadata == null ? "" : JSON.stringify(row.metadata), "utf8"),
  ]);
  return createHmac("sha256", key).update(concat).digest();
}

type AuditRow = {
  id: string;
  occurredAt: Date;
  kind: string;
  userId: number | null;
  actorLabel: string | null;
  ip: string | null;
  userAgent: string | null;
  resource: string | null;
  resourceId: string | null;
  outcome: string;
  message: string | null;
  metadata: unknown;
  prevHash: Buffer;
  entryHash: Buffer;
};

export async function verifyAuditChain(limit = 10_000): Promise<bigint | null> {
  const key = hmacKey();
  const result = await sql<AuditRow>`
    SELECT
      id::text,
      occurred_at AS "occurredAt",
      kind::text,
      user_id AS "userId",
      actor_label AS "actorLabel",
      ip,
      user_agent AS "userAgent",
      resource,
      resource_id AS "resourceId",
      outcome,
      message,
      metadata,
      prev_hash AS "prevHash",
      entry_hash AS "entryHash"
    FROM audit_logs
    ORDER BY id ASC
    LIMIT ${limit}
  `.execute(kysely);
  let prev = ZERO_HASH;
  for (const row of result.rows) {
    if (!Buffer.from(row.prevHash).equals(prev)) {
      return BigInt(row.id);
    }
    const recomputed = rowDigest(prev, row, key);
    if (!recomputed.equals(Buffer.from(row.entryHash))) {
      return BigInt(row.id);
    }
    prev = Buffer.from(row.entryHash);
  }
  return null;
}
