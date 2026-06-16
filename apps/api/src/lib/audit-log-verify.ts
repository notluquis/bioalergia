import { kysely } from "@finanzas/db";
import { sql } from "kysely";

// Standalone verifier for the audit_logs HMAC chain. Mirrors the trigger
// function `audit_log_chain()` (migration 20260512010000) so the result here
// matches what Postgres computed at insert time.
//
// The HMAC recompute runs IN SQL using the same pgcrypto `hmac`/`digest`
// functions the trigger used — NOT reimplemented in JS. Reproducing Postgres'
// exact byte serialization in JS is fragile (jsonb `::text` inserts spaces
// after `:`/`,`, timestamp precision, enum `::text`, client encoding), so JS
// only runs the link-membership + key-latch logic over rows the database
// returns. This eliminates all JS/SQL serialization drift.
//
// Returns the first row id that fails verification, or null if the chain is
// intact end-to-end. Run from a cron / nightly job and alert on any non-null
// result — it indicates tampering or a divergent HMAC key.
//
// Usage:
//   const tampered = await verifyAuditChain();
//   if (tampered !== null) emitTamperingAlert(tampered);

const ZERO_HEX = "00".repeat(32);

export type RowCheck = {
  id: string;
  prevHashHex: string;
  entryHashHex: string;
  // entry_hash recomputes correctly under the real env key / the dev fallback.
  matchesReal: boolean;
  matchesDev: boolean;
};

// Pure verifier over the per-row data the database returns. Extracted so the
// link-membership and key-latch logic is unit-testable without a DB.
//
// LINK (membership, not strict-linear): the trigger picks prev_hash via
// `SELECT entry_hash ... ORDER BY id DESC LIMIT 1` at BEFORE INSERT — which is
// NOT concurrency-safe, so near-simultaneous inserts legitimately fork the
// chain (two rows share a predecessor). We therefore require each row's
// prev_hash to be the genesis zero hash OR the entry_hash of SOME earlier row
// (tracked in `seen`), rather than strictly the immediately-preceding row.
// This still catches tampering (the row's own HMAC fails) and deletion (a
// surviving successor's prev_hash is no longer in `seen` → orphan), while
// tolerating concurrent forks.
//
// KEY (forward latch): rows before the AUDIT_HMAC_KEY cutover were chained
// with the per-DB dev fallback (the key was unset until provisioned in
// Railway), rows after with the real key. We accept either key until the first
// row that verifies with the real key, then latch and require the real key for
// every subsequent row. This rejects a dev-key downgrade-forge on post-cutover
// rows (the dev key is derivable from the DB name) while tolerating the
// redeploy transition. Any ambiguous edge fails closed (returns a tampered id
// → critical alert), never open.
export function verifyRows(rows: RowCheck[]): bigint | null {
  const seen = new Set<string>();
  let latchedReal = false;
  for (const row of rows) {
    const linkOk = row.prevHashHex === ZERO_HEX || seen.has(row.prevHashHex);
    if (!linkOk) {
      return BigInt(row.id);
    }
    if (row.matchesReal) {
      latchedReal = true;
    } else if (latchedReal || !row.matchesDev) {
      return BigInt(row.id);
    }
    seen.add(row.entryHashHex);
  }
  return null;
}

// The real key as a 64-hex string, matching the trigger's `decode(raw, 'hex')`
// branch. We always provision a 64-hex key, so we require that form.
function hmacKeyHex(): string {
  const raw = process.env.AUDIT_HMAC_KEY;
  if (!raw) {
    throw new Error("AUDIT_HMAC_KEY env required to verify chain in production");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error("AUDIT_HMAC_KEY must be 64 hex chars");
  }
  return raw;
}

export async function verifyAuditChain(limit = 10_000): Promise<bigint | null> {
  const keyHex = hmacKeyHex();
  // Recompute each row's entry_hash in SQL under both candidate keys, using the
  // exact field concatenation from the trigger. Link-membership + latch run in
  // JS over the returned hashes (see verifyRows).
  const result = await sql<RowCheck>`
    WITH chain AS (
      SELECT
        id,
        prev_hash,
        entry_hash,
        prev_hash
          || COALESCE(occurred_at::text, '')::bytea
          || COALESCE(kind::text, '')::bytea
          || COALESCE(user_id::text, '')::bytea
          || COALESCE(actor_label, '')::bytea
          || COALESCE(ip, '')::bytea
          || COALESCE(user_agent, '')::bytea
          || COALESCE(resource, '')::bytea
          || COALESCE(resource_id, '')::bytea
          || COALESCE(outcome, '')::bytea
          || COALESCE(message, '')::bytea
          || COALESCE(metadata::text, '')::bytea AS payload
      FROM audit_logs
      ORDER BY id ASC
      LIMIT ${limit}
    )
    SELECT
      id::text AS id,
      encode(prev_hash, 'hex') AS "prevHashHex",
      encode(entry_hash, 'hex') AS "entryHashHex",
      entry_hash = hmac(payload, decode(${keyHex}, 'hex'), 'sha256') AS "matchesReal",
      entry_hash = hmac(
        payload,
        digest('audit-log-dev-' || current_database(), 'sha256'),
        'sha256'
      ) AS "matchesDev"
    FROM chain
    -- Qualified (chain.id) so it binds to the numeric input column, NOT the
    -- "id::text AS id" output alias — a bare "ORDER BY id" would sort the text
    -- alias lexicographically (1, 10, 100, 1000, …, 2) and break link order.
    ORDER BY chain.id ASC
  `.execute(kysely);
  return verifyRows(result.rows);
}
