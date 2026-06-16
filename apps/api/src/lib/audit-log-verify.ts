import { kysely } from "@finanzas/db";
import { createHash, createHmac } from "node:crypto";
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
    throw new Error("AUDIT_HMAC_KEY env required to verify chain in production");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return createHmac("sha256", "fallback").update(raw).digest();
}

// Mirror the trigger's dev fallback (migration 20260512010000):
//   k := digest('audit-log-dev-' || current_database(), 'sha256')
// This is a plain SHA-256 (pgcrypto digest), NOT an HMAC. Rows inserted
// before AUDIT_HMAC_KEY was set in the env were chained with this key
// because the GUC `app.audit_hmac_key` was never set on the connection
// (client.ts only sets it when the env var is present). We need it so
// the verifier can validate the legacy prefix of the chain.
export function devFallbackKey(dbName: string): Buffer {
  return createHash("sha256").update(`audit-log-dev-${dbName}`).digest();
}

// Pure verifier over an already-fetched, id-ASC ordered chain. Extracted so
// the latch logic is unit-testable without a DB. Returns the id of the first
// row that fails its link or HMAC, or null if the chain is intact.
//
// Forward latch: rows before the key cutover were chained with the dev
// fallback, rows after with the real key. We don't store the boundary id —
// instead we accept either key until the first row that verifies with the
// real key, then latch and require the real key for every subsequent row.
// This rejects a dev-key downgrade-forge on post-cutover rows (the dev key is
// derivable from the DB name, so it must not be accepted once the real key is
// in force) while tolerating the redeploy transition. Any ambiguous edge fails
// closed (returns a tampered id → critical alert), never open.
export function verifyRows(rows: AuditRow[], realKey: Buffer, devKey: Buffer): bigint | null {
  let prev = ZERO_HASH;
  let latchedReal = false;
  for (const row of rows) {
    if (!Buffer.from(row.prevHash).equals(prev)) {
      return BigInt(row.id);
    }
    const entry = Buffer.from(row.entryHash);
    if (rowDigest(prev, row, realKey).equals(entry)) {
      latchedReal = true;
    } else if (latchedReal || !rowDigest(prev, row, devKey).equals(entry)) {
      return BigInt(row.id);
    }
    prev = entry;
  }
  return null;
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

export type AuditRow = {
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
  const realKey = hmacKey();
  // Legacy prefix of the chain was HMAC'd with the per-DB dev fallback
  // (AUDIT_HMAC_KEY was unset until it was provisioned in Railway). The DB
  // name must match what Postgres saw at insert time.
  const dbNameRow = await sql<{ db: string }>`SELECT current_database() AS db`.execute(kysely);
  const devKey = devFallbackKey(dbNameRow.rows[0]?.db ?? "");
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
  return verifyRows(result.rows, realKey, devKey);
}
