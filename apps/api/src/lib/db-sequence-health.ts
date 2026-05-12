import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logEvent, logWarn } from "./logger.ts";

const logInfo = logEvent;

// Boot-time DB integrity check that detects and (optionally) repairs
// integer id sequences whose nextval() has fallen behind MAX(id). Runs
// once on API start and emits a structured warning per drifted sequence.
//
// Why: bulk SQL imports / pg_dump restores can insert rows with explicit
// id values that bypass the sequence; subsequent ORM inserts then crash
// with "duplicate key value violates unique constraint <table>_pkey".
// The 20260512001500_resync_id_sequences migration cures the historical
// drift; this check catches future occurrences without blocking startup.
//
// Behavior:
//   - When DB_SEQUENCE_AUTO_REPAIR=1 (default in production), drifted
//     sequences are setval()'d to MAX(id) and a `repaired` log line
//     is emitted.
//   - Otherwise the check is read-only: drift is logged for the
//     operator to investigate without auto-repair.
//
// Cost: one CTE query against pg_class / information_schema; ~10 ms
// on a Railway PG instance with <100 sequences.

type DriftRow = {
  tableName: string;
  sequenceName: string;
  lastValue: string;
  maxId: string;
};

const AUTO_REPAIR_ENV = "DB_SEQUENCE_AUTO_REPAIR";

function autoRepairEnabled(): boolean {
  const raw = process.env[AUTO_REPAIR_ENV];
  if (raw === undefined) return process.env.NODE_ENV === "production";
  return raw === "1" || raw.toLowerCase() === "true";
}

async function findDriftedSequences(): Promise<DriftRow[]> {
  // Step 1: enumerate every public.<table>_id_seq with its current
  // last_value. Cheap single-query catalog lookup.
  const seqs = await sql<{
    tableName: string;
    sequenceName: string;
    lastValue: string;
  }>`
    SELECT
      c.table_name AS "tableName",
      c.table_name || '_id_seq' AS "sequenceName",
      ps.last_value::text AS "lastValue"
    FROM information_schema.columns c
    JOIN information_schema.sequences s
      ON s.sequence_name = c.table_name || '_id_seq'
     AND s.sequence_schema = c.table_schema
    JOIN pg_sequences ps
      ON ps.sequencename = c.table_name || '_id_seq'
     AND ps.schemaname = c.table_schema
    WHERE c.column_name = 'id'
      AND c.data_type IN ('integer', 'bigint')
      AND c.table_schema = 'public'
  `.execute(kysely);

  // Step 2: per-table SELECT MAX(id). Cheap because every table has a
  // primary-key index on id; this is a single index-only scan each.
  const rows: DriftRow[] = [];
  for (const seq of seqs.rows) {
    const max = await sql<{ maxId: string | null }>`
      SELECT COALESCE(MAX(id), 0)::text AS "maxId" FROM ${sql.id(seq.tableName)}
    `.execute(kysely);
    const maxId = max.rows[0]?.maxId ?? "0";
    if (BigInt(maxId) > BigInt(seq.lastValue)) {
      rows.push({ ...seq, maxId });
    }
  }
  return rows;
}

export async function runSequenceHealthCheck(): Promise<void> {
  let drifted: DriftRow[];
  try {
    drifted = await findDriftedSequences();
  } catch (err) {
    logWarn("[db.sequence-health] check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (drifted.length === 0) {
    logInfo("[db.sequence-health] all id sequences in sync");
    return;
  }

  const repair = autoRepairEnabled();
  for (const row of drifted) {
    logWarn("[db.sequence-health] drift detected", {
      table: row.tableName,
      sequence: row.sequenceName,
      lastValue: row.lastValue,
      maxId: row.maxId,
      autoRepair: repair,
    });
  }

  if (!repair) return;

  for (const row of drifted) {
    try {
      await sql`SELECT setval(${row.sequenceName}, ${BigInt(row.maxId)})`.execute(kysely);
      logInfo("[db.sequence-health] repaired", {
        sequence: row.sequenceName,
        newValue: row.maxId,
      });
    } catch (err) {
      logWarn("[db.sequence-health] repair failed", {
        sequence: row.sequenceName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
