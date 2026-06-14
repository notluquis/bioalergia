import { db, kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logAuditEvent } from "./audit-log.ts";
import { logEvent, logWarn } from "./logger.ts";

// Automated PII retention sweep (Ley 21.719 — principio de limitación del
// plazo de conservación, vigente 1-dic-2026). Reads ENABLED rows from
// `data_retention_policies` and, per policy, either DELETEs or ANONYMIZEs
// rows older than `windowDays` measured from `dateColumn`.
//
// Mirrors lib/cleanup-orphans.ts:
//   - bounded by SAFETY_LIMIT so a misconfigured window can never nuke a
//     whole table in one tick — the next nightly run picks up the rest.
//   - behavior gate via env DB_RETENTION_SWEEP (unset/!=1 → dry-run: counts
//     only, no mutations). Safe to enable in count-only mode first.
//
// HARD GUARD: the ficha clínica is conserved 15 years (Decreto 41/2012) and
// is NEVER touched. The policy table simply won't carry rows for clinical
// tables, but we ALSO refuse to operate on a denylisted table in code — a
// stray INSERT into the policy row must not be able to reach a clinical sweep.
//
// Refs:
//   - Ley 21.719 (Chile) — limitación del plazo de conservación
//   - Ley 20.584 Art. 13 — minimization principle
//   - Decreto 41/2012 — ficha clínica 15 años (excluded)
//   - HHS HIPAA §164.316(b)(2)(iii) Documentation review/update

const SAFETY_LIMIT = 1000;
const ENV_FLAG = "DB_RETENTION_SWEEP";

// Clinical / ficha tables — 15-yr retention. NEVER swept regardless of any
// policy row. Match against the policy `table` value (physical table name).
const CLINICAL_DENYLIST: ReadonlySet<string> = new Set([
  "clinical_records",
  "clinical_series",
  "clinical_skin_tests",
  "clinical_skin_test_imports",
  "clinical_skin_test_results",
  "events",
  "prescriptions",
  "medical_prescriptions",
  "medical_certificates",
]);

// Physical identifier guard: tables/columns come from a DB-config row, so we
// only ever interpolate names that match a strict snake_case identifier. This
// blocks SQL injection through the policy table (the names are raw-spliced
// into the statement; values use bound params).
const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

function executeEnabled(): boolean {
  const raw = process.env[ENV_FLAG];
  return raw === "1" || raw?.toLowerCase() === "true";
}

export type PolicyAction = "delete" | "anonymize";

export type AnonymizeRule =
  | { set: "null" }
  | { set: "hash" }
  | { set: "fixed"; value: string };

export type RetentionPolicyResult = {
  table: string;
  action: PolicyAction;
  windowDays: number;
  dateColumn: string;
  matched: number;
  affected: number;
  skipped?: "denylisted" | "invalid";
};

export type RetentionSweepReport = {
  dryRun: boolean;
  policiesEvaluated: number;
  totalMatched: number;
  totalAffected: number;
  results: RetentionPolicyResult[];
  durationMs: number;
};

type PolicyRow = {
  table: string;
  enabled: boolean;
  action: string;
  windowDays: number;
  dateColumn: string;
  anonymizeMap: unknown;
};

function isAnonymizeRule(v: unknown): v is AnonymizeRule {
  if (typeof v !== "object" || v === null) return false;
  const set = (v as { set?: unknown }).set;
  if (set === "null" || set === "hash") return true;
  if (set === "fixed" && typeof (v as { value?: unknown }).value === "string") return true;
  return false;
}

function validIdent(name: string): boolean {
  return IDENT_RE.test(name);
}

// Count rows matching the age predicate (always runs — dry-run + execute both
// report `matched`). Bounded by SAFETY_LIMIT so the count mirrors the cap.
async function countExpired(table: string, dateColumn: string, windowDays: number) {
  const res = await sql<{ n: number }>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1 FROM ${sql.table(table)}
      WHERE ${sql.ref(dateColumn)} < (now() - ${sql.lit(`${windowDays} days`)}::interval)
      LIMIT ${sql.lit(SAFETY_LIMIT)}
    ) capped
  `.execute(kysely);
  return res.rows[0]?.n ?? 0;
}

async function deleteExpired(table: string, dateColumn: string, windowDays: number) {
  // Bounded DELETE via ctid subselect (Postgres has no DELETE ... LIMIT).
  const res = await sql`
    DELETE FROM ${sql.table(table)}
    WHERE ctid IN (
      SELECT ctid FROM ${sql.table(table)}
      WHERE ${sql.ref(dateColumn)} < (now() - ${sql.lit(`${windowDays} days`)}::interval)
      LIMIT ${sql.lit(SAFETY_LIMIT)}
    )
  `.execute(kysely);
  return Number(res.numAffectedRows ?? 0n);
}

function ruleToAssignment(column: string, rule: AnonymizeRule) {
  if (rule.set === "null") {
    return sql`${sql.ref(column)} = NULL`;
  }
  if (rule.set === "hash") {
    // md5(text) — irreversible token; preserves join-ability for stats while
    // dropping the PII. NULL-safe (md5(NULL) = NULL).
    return sql`${sql.ref(column)} = md5(${sql.ref(column)}::text)`;
  }
  // fixed
  return sql`${sql.ref(column)} = ${rule.value}`;
}

async function anonymizeExpired(
  table: string,
  dateColumn: string,
  windowDays: number,
  anonymizeMap: Record<string, AnonymizeRule>
) {
  const assignments = Object.entries(anonymizeMap)
    .filter(([col]) => validIdent(col))
    .map(([col, rule]) => ruleToAssignment(col, rule));
  if (assignments.length === 0) return 0;

  const res = await sql`
    UPDATE ${sql.table(table)}
    SET ${sql.join(assignments, sql`, `)}
    WHERE ctid IN (
      SELECT ctid FROM ${sql.table(table)}
      WHERE ${sql.ref(dateColumn)} < (now() - ${sql.lit(`${windowDays} days`)}::interval)
      LIMIT ${sql.lit(SAFETY_LIMIT)}
    )
  `.execute(kysely);
  return Number(res.numAffectedRows ?? 0n);
}

async function loadEnabledPolicies(): Promise<PolicyRow[]> {
  const rows = await db.dataRetentionPolicy.findMany({ where: { enabled: true } });
  return rows.map((r: PolicyRow) => ({
    table: r.table,
    enabled: r.enabled,
    action: r.action,
    windowDays: r.windowDays,
    dateColumn: r.dateColumn,
    anonymizeMap: r.anonymizeMap,
  }));
}

export async function runRetentionSweep(): Promise<RetentionSweepReport> {
  const startedAt = Date.now();
  const execute = executeEnabled();
  const report: RetentionSweepReport = {
    dryRun: !execute,
    policiesEvaluated: 0,
    totalMatched: 0,
    totalAffected: 0,
    results: [],
    durationMs: 0,
  };

  let policies: PolicyRow[];
  try {
    policies = await loadEnabledPolicies();
  } catch (err) {
    logWarn("[db.retention-sweep] failed to load policies", {
      error: err instanceof Error ? err.message : String(err),
    });
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  for (const policy of policies) {
    report.policiesEvaluated += 1;
    const action = policy.action === "anonymize" ? "anonymize" : "delete";
    const base: RetentionPolicyResult = {
      table: policy.table,
      action,
      windowDays: policy.windowDays,
      dateColumn: policy.dateColumn,
      matched: 0,
      affected: 0,
    };

    // HARD GUARD: never operate on a clinical / ficha table, even if a policy
    // row exists for it. Also validate identifiers + window before any SQL.
    if (
      CLINICAL_DENYLIST.has(policy.table) ||
      !validIdent(policy.table) ||
      !validIdent(policy.dateColumn)
    ) {
      logWarn("[db.retention-sweep] policy skipped (denylisted/invalid)", {
        table: policy.table,
        dateColumn: policy.dateColumn,
      });
      report.results.push({
        ...base,
        skipped: CLINICAL_DENYLIST.has(policy.table) ? "denylisted" : "invalid",
      });
      continue;
    }

    if (!Number.isInteger(policy.windowDays) || policy.windowDays < 0) {
      report.results.push({ ...base, skipped: "invalid" });
      continue;
    }

    try {
      const matched = await countExpired(policy.table, policy.dateColumn, policy.windowDays);
      base.matched = matched;
      report.totalMatched += matched;

      if (execute && matched > 0) {
        if (action === "delete") {
          base.affected = await deleteExpired(
            policy.table,
            policy.dateColumn,
            policy.windowDays
          );
        } else {
          const map: Record<string, AnonymizeRule> = {};
          if (typeof policy.anonymizeMap === "object" && policy.anonymizeMap !== null) {
            for (const [col, rule] of Object.entries(
              policy.anonymizeMap as Record<string, unknown>
            )) {
              if (isAnonymizeRule(rule)) map[col] = rule;
            }
          }
          base.affected = await anonymizeExpired(
            policy.table,
            policy.dateColumn,
            policy.windowDays,
            map
          );
        }
        report.totalAffected += base.affected;
      }
      report.results.push(base);
    } catch (err) {
      logWarn("[db.retention-sweep] policy failed", {
        table: policy.table,
        error: err instanceof Error ? err.message : String(err),
      });
      report.results.push({ ...base, skipped: "invalid" });
    }
  }

  report.durationMs = Date.now() - startedAt;

  // Audit trail: one ADMIN_ACTION row summarizing the sweep (append-only,
  // HMAC-chained). Best-effort — logAuditEvent swallows DB failures.
  await logAuditEvent({
    kind: "ADMIN_ACTION",
    actorLabel: "system:retention-sweep",
    resource: "data_retention_policies",
    outcome: "ok",
    message: report.dryRun
      ? `retention sweep (dry-run): ${report.totalMatched} rows matched across ${report.policiesEvaluated} policies`
      : `retention sweep: ${report.totalAffected} rows purged/anonymized across ${report.policiesEvaluated} policies`,
    metadata: {
      dryRun: report.dryRun,
      policiesEvaluated: report.policiesEvaluated,
      totalMatched: report.totalMatched,
      totalAffected: report.totalAffected,
      results: report.results,
    },
  });

  logEvent("[db.retention-sweep] sweep complete", {
    dryRun: report.dryRun,
    policiesEvaluated: report.policiesEvaluated,
    totalMatched: report.totalMatched,
    totalAffected: report.totalAffected,
    durationMs: report.durationMs,
  });

  return report;
}
