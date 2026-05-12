import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logEvent, logWarn } from "./logger.ts";

const logInfo = logEvent;

// Boot-time DB integrity check that detects + (optionally) repairs
// integer/bigint sequences whose nextval() has fallen behind MAX(id).
// Runs once on API start, emits a structured event per drifted row,
// and in production auto-repairs by calling setval(seq, MAX(id), true).
//
// Why this matters: bulk SQL imports / pg_dump restores insert rows
// with explicit `id` values that bypass the sequence. The next ORM
// insert then crashes with "duplicate key value violates unique
// constraint <table>_pkey" because nextval() returns an id that's
// already in use.
//
// Detection (golden 2026 pattern):
//
//   - Use pg_attribute + pg_depend to enumerate ALL sequences whose
//     owner is an integer / bigint column (covers SERIAL, BIGSERIAL,
//     IDENTITY, and manually-attached sequences). The legacy
//     "<table>_id_seq" string convention is unreliable — IDENTITY
//     columns and renamed sequences break it.
//
//   - One LATERAL subquery per row computes MAX(<owning column>),
//     so the entire sweep is a single round trip to Postgres
//     (was N+1 in the previous version).
//
//   - Skip non-public schemas, skip sequences in toast/temp namespaces.
//
// Repair:
//
//   - setval(seq, GREATEST(last_value, MAX(id)), true). The third arg
//     true marks is_called=true so the next nextval() returns
//     MAX(id)+1, never the same value.
//
//   - Wrapped in pg_advisory_xact_lock(hashtextextended(seq, 0)) so
//     two concurrent boots (multiple replicas) cannot race the same
//     setval and end up with one of them stomping a fresh INSERT
//     between detection and repair.
//
// Behavior gate:
//
//   - DB_SEQUENCE_AUTO_REPAIR=1 → repair (default in production).
//   - Anything else → log only.
//
// Refs:
//   - PostgreSQL §9.17 Sequence Manipulation Functions
//   - https://wiki.postgresql.org/wiki/Fixing_Sequences
//   - PostgreSQL pg_depend, pg_attribute catalog reference

const AUTO_REPAIR_ENV = "DB_SEQUENCE_AUTO_REPAIR";

type DriftRow = {
  schemaName: string;
  tableName: string;
  columnName: string;
  sequenceName: string;
  lastValue: string;
  maxId: string;
};

export type SequenceHealthReport = {
  inspected: number;
  drifted: number;
  repaired: number;
  failed: number;
  durationMs: number;
};

function autoRepairEnabled(): boolean {
  const raw = process.env[AUTO_REPAIR_ENV];
  if (raw === undefined) return process.env.NODE_ENV === "production";
  return raw === "1" || raw.toLowerCase() === "true";
}

async function findDriftedSequences(): Promise<{ drifted: DriftRow[]; inspected: number }> {
  // Two-phase plan because Kysely's sql template can't inject
  // identifiers per-row inside a single CTE LATERAL:
  //   1. One catalog query enumerates every sequence with the table +
  //      column it actually owns (pg_class + pg_depend + pg_attribute).
  //      Covers SERIAL, BIGSERIAL, IDENTITY and manually-attached
  //      sequences without depending on the legacy `<table>_id_seq`
  //      naming convention.
  //   2. Per-sequence MAX(<column>) loop. Bounded by ~100 sequences,
  //      finishes in <500ms on a Railway PG cold start. Each query is
  //      a single index-only scan against the table's primary key.
  const rows: DriftRow[] = [];
  const meta = await sql<{
    schemaName: string;
    tableName: string;
    columnName: string;
    sequenceName: string;
    lastValue: string | null;
  }>`
    SELECT
      ns.nspname           AS "schemaName",
      rel.relname          AS "tableName",
      att.attname          AS "columnName",
      cls.relname          AS "sequenceName",
      ps.last_value::text  AS "lastValue"
    FROM pg_class cls
    JOIN pg_namespace ns_seq ON ns_seq.oid = cls.relnamespace
    JOIN pg_depend dep
      ON dep.objid = cls.oid
     AND dep.classid = 'pg_class'::regclass
     AND dep.refclassid = 'pg_class'::regclass
     AND dep.deptype IN ('a', 'i', 'n')
    JOIN pg_class rel ON rel.oid = dep.refobjid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = rel.oid
     AND att.attnum = dep.refobjsubid
     AND att.attnum > 0
     AND NOT att.attisdropped
    JOIN pg_sequences ps
      ON ps.schemaname = ns_seq.nspname
     AND ps.sequencename = cls.relname
    WHERE cls.relkind = 'S'
      AND ns_seq.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND ns.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      AND format_type(att.atttypid, NULL) IN ('integer', 'bigint', 'smallint')
  `.execute(kysely);

  for (const m of meta.rows) {
    const max = await sql<{ maxId: string | null }>`
      SELECT COALESCE(MAX(${sql.id(m.columnName)}), 0)::text AS "maxId"
      FROM ${sql.id(m.schemaName, m.tableName)}
    `.execute(kysely);
    const maxId = max.rows[0]?.maxId ?? "0";
    // last_value is NULL on a sequence that was created but never
    // nextval'd (is_called = false). Treat as 0 so a fresh table with
    // no rows reports no drift.
    const lastValue = m.lastValue ?? "0";
    if (BigInt(maxId) > BigInt(lastValue)) {
      rows.push({
        schemaName: m.schemaName,
        tableName: m.tableName,
        columnName: m.columnName,
        sequenceName: m.sequenceName,
        lastValue,
        maxId,
      });
    }
  }
  return { drifted: rows, inspected: meta.rows.length };
}

async function repairSequence(row: DriftRow): Promise<void> {
  // Take a per-sequence advisory lock so two API replicas booting in
  // parallel can't both compute MAX, both call setval, and stomp a
  // fresh INSERT that landed between the two operations. The lock is
  // released at transaction commit/rollback.
  const qualifiedSeq = `${row.schemaName}.${row.sequenceName}`;
  await kysely.transaction().execute(async (trx) => {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`seq:${qualifiedSeq}`}, 0))`.execute(
      trx,
    );
    // Re-read MAX inside the locked transaction so a concurrent INSERT
    // that just happened still gets covered by the bump.
    const max = await sql<{ maxId: string | null }>`
      SELECT COALESCE(MAX(${sql.id(row.columnName)}), 0)::text AS "maxId"
      FROM ${sql.id(row.schemaName, row.tableName)}
    `.execute(trx);
    const target = max.rows[0]?.maxId ?? "0";
    if (BigInt(target) <= BigInt(row.lastValue)) return;
    await sql`SELECT setval(${qualifiedSeq}, ${BigInt(target)}, true)`.execute(trx);
  });
}

export async function runSequenceHealthCheck(): Promise<SequenceHealthReport> {
  const startedAt = Date.now();
  const report: SequenceHealthReport = {
    inspected: 0,
    drifted: 0,
    repaired: 0,
    failed: 0,
    durationMs: 0,
  };

  let drifted: DriftRow[];
  try {
    const found = await findDriftedSequences();
    drifted = found.drifted;
    report.inspected = found.inspected;
  } catch (err) {
    logWarn("[db.sequence-health] check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  report.drifted = drifted.length;

  if (drifted.length === 0) {
    report.durationMs = Date.now() - startedAt;
    logInfo("[db.sequence-health] all id sequences in sync", { ms: report.durationMs });
    return report;
  }

  const repair = autoRepairEnabled();
  for (const row of drifted) {
    logWarn("[db.sequence-health] drift detected", {
      schema: row.schemaName,
      table: row.tableName,
      column: row.columnName,
      sequence: row.sequenceName,
      lastValue: row.lastValue,
      maxId: row.maxId,
      autoRepair: repair,
    });
  }

  if (!repair) {
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  for (const row of drifted) {
    try {
      await repairSequence(row);
      report.repaired += 1;
      logInfo("[db.sequence-health] repaired", {
        schema: row.schemaName,
        table: row.tableName,
        sequence: row.sequenceName,
        newValue: row.maxId,
      });
    } catch (err) {
      report.failed += 1;
      logWarn("[db.sequence-health] repair failed", {
        sequence: row.sequenceName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  report.durationMs = Date.now() - startedAt;
  return report;
}
