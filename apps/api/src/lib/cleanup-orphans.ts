import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logEvent, logWarn } from "./logger.ts";

// Orphan cleanup sweep. Runs nightly after the duplicate-merge work
// (script merge-duplicate-persons-by-rut.ts and the ficha clínica
// pipeline) leaves rows with no children behind:
//
//   - clinical_series with NO events / skin_tests / records
//   - patients with NO clinical_series / consultations / payments /
//     budgets / shipments / certificates / attachments / dte links
//   - people with NO patient / user / employee / addresses
//
// Deletes are CASCADEd by FK definitions, so we delete in dependency
// order (clinical_series → patients → people). Each step is bounded
// by SAFETY_LIMIT to prevent a runaway sweep from nuking the database
// if a metric query goes wrong; the limit is logged and the next
// nightly run picks up where this one stopped.
//
// Behavior gate:
//
//   - DB_ORPHAN_CLEANUP=1 → execute deletes
//   - default                → dry-run, only counts (safe to enable
//                              before flipping deletes on)
//
// Refs:
//   - HHS HIPAA §164.316(b)(2)(iii) Documentation review/update
//   - Chile Ley 20.584 Art. 13 — minimization principle

const SAFETY_LIMIT = 500;
const AGE_THRESHOLD_DAYS = 30;
const ENV_FLAG = "DB_ORPHAN_CLEANUP";

export type OrphanCleanupReport = {
  clinicalSeriesScanned: number;
  clinicalSeriesDeleted: number;
  patientsScanned: number;
  patientsDeleted: number;
  peopleScanned: number;
  peopleDeleted: number;
  durationMs: number;
  dryRun: boolean;
};

function executeEnabled(): boolean {
  const raw = process.env[ENV_FLAG];
  return raw === "1" || raw?.toLowerCase() === "true";
}

async function cleanupOrphanClinicalSeries(execute: boolean) {
  // Empty series safe to delete — guard with three filters so the
  // sweep never removes legitimately-tracked identities:
  //
  //   1. Status not in (ACTIVE, PLANNED) — only INACTIVE / CANCELLED
  //      / COMPLETED rows are candidates (the operator already moved
  //      them out of the working set).
  //   2. Older than the AGE_THRESHOLD_DAYS window (default 30) so
  //      planned-but-empty rows have time to gain content.
  //   3. No patient_rut populated. A series carrying a RUT is the
  //      historical link to an identity even when the underlying
  //      tests live elsewhere; an operator should merge those by
  //      hand, never the cleanup sweep.
  //
  // SUBCUTANEOUS_TREATMENT and MEDICAL_CONSULTATION excluded entirely
  // — treatments + fichas clínicas roll up via a single per-patient
  // series whose emptiness is meaningful.
  const candidates = await sql<{ id: number }>`
    SELECT cs.id
    FROM clinical_series cs
    LEFT JOIN events e               ON e.clinical_series_id = cs.id
    LEFT JOIN clinical_skin_tests t  ON t.clinical_series_id = cs.id
    LEFT JOIN clinical_records r     ON r.clinical_series_id = cs.id
    WHERE cs.kind IN ('SKIN_TEST', 'PATCH_TEST')
      AND cs.status NOT IN ('ACTIVE', 'PLANNED')
      AND cs.patient_rut IS NULL
      AND cs.created_at < (now() - interval '${sql.raw(String(AGE_THRESHOLD_DAYS))} days')
    GROUP BY cs.id
    HAVING COUNT(e.id) = 0 AND COUNT(t.id) = 0 AND COUNT(r.id) = 0
    LIMIT ${SAFETY_LIMIT}
  `.execute(kysely);
  if (!execute || candidates.rows.length === 0) {
    return { scanned: candidates.rows.length, deleted: 0 };
  }
  const ids = candidates.rows.map((r) => r.id);
  await sql`DELETE FROM clinical_series WHERE id = ANY(${ids})`.execute(kysely);
  return { scanned: candidates.rows.length, deleted: ids.length };
}

async function cleanupOrphanPatients(execute: boolean) {
  // Only patients older than the age threshold and with NO child rows
  // anywhere — a fresh patient created seconds ago by a half-completed
  // form should not vanish before the operator finishes typing.
  const candidates = await sql<{ id: number }>`
    SELECT p.id
    FROM patients p
    LEFT JOIN clinical_series cs   ON cs.patient_id = p.id
    LEFT JOIN consultations c      ON c.patient_id = p.id
    LEFT JOIN patient_payments pp  ON pp.patient_id = p.id
    LEFT JOIN budgets b            ON b.patient_id = p.id
    LEFT JOIN shipments s          ON s.patient_id = p.id
    LEFT JOIN medical_certificates mc ON mc.patient_id = p.id
    LEFT JOIN patient_attachments pa  ON pa.patient_id = p.id
    LEFT JOIN patient_dte_sale_sources pds ON pds.patient_id = p.id
    WHERE p.created_at < (now() - interval '${sql.raw(String(AGE_THRESHOLD_DAYS))} days')
    GROUP BY p.id
    HAVING COUNT(cs.id) = 0 AND COUNT(c.id) = 0 AND COUNT(pp.id) = 0
       AND COUNT(b.id) = 0 AND COUNT(s.id) = 0 AND COUNT(mc.id) = 0
       AND COUNT(pa.id) = 0 AND COUNT(pds.id) = 0
    LIMIT ${SAFETY_LIMIT}
  `.execute(kysely);
  if (!execute || candidates.rows.length === 0) {
    return { scanned: candidates.rows.length, deleted: 0 };
  }
  const ids = candidates.rows.map((r) => r.id);
  await sql`DELETE FROM patients WHERE id = ANY(${ids})`.execute(kysely);
  return { scanned: candidates.rows.length, deleted: ids.length };
}

async function cleanupOrphanPeople(execute: boolean) {
  // Same age threshold as patients. Also keep any row carrying a
  // valid RUT — even if every link is gone, a populated RUT is
  // identity evidence the operator may want to merge later.
  const candidates = await sql<{ id: number }>`
    SELECT pe.id
    FROM people pe
    LEFT JOIN patients pa  ON pa.person_id = pe.id
    LEFT JOIN users u      ON u.person_id  = pe.id
    LEFT JOIN employees em ON em.person_id = pe.id
    LEFT JOIN addresses ad ON ad.person_id = pe.id
    WHERE pe.created_at < (now() - interval '${sql.raw(String(AGE_THRESHOLD_DAYS))} days')
      AND pe.rut IS NULL
    GROUP BY pe.id
    HAVING COUNT(pa.id) = 0 AND COUNT(u.id) = 0
       AND COUNT(em.id) = 0 AND COUNT(ad.id) = 0
    LIMIT ${SAFETY_LIMIT}
  `.execute(kysely);
  if (!execute || candidates.rows.length === 0) {
    return { scanned: candidates.rows.length, deleted: 0 };
  }
  const ids = candidates.rows.map((r) => r.id);
  await sql`DELETE FROM people WHERE id = ANY(${ids})`.execute(kysely);
  return { scanned: candidates.rows.length, deleted: ids.length };
}

export async function runOrphanCleanup(): Promise<OrphanCleanupReport> {
  const startedAt = Date.now();
  const execute = executeEnabled();
  const report: OrphanCleanupReport = {
    clinicalSeriesScanned: 0,
    clinicalSeriesDeleted: 0,
    patientsScanned: 0,
    patientsDeleted: 0,
    peopleScanned: 0,
    peopleDeleted: 0,
    durationMs: 0,
    dryRun: !execute,
  };

  try {
    const cs = await cleanupOrphanClinicalSeries(execute);
    report.clinicalSeriesScanned = cs.scanned;
    report.clinicalSeriesDeleted = cs.deleted;

    const pa = await cleanupOrphanPatients(execute);
    report.patientsScanned = pa.scanned;
    report.patientsDeleted = pa.deleted;

    const pe = await cleanupOrphanPeople(execute);
    report.peopleScanned = pe.scanned;
    report.peopleDeleted = pe.deleted;
  } catch (err) {
    logWarn("[db.orphan-cleanup] sweep failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  report.durationMs = Date.now() - startedAt;
  logEvent("[db.orphan-cleanup] sweep complete", { ...report });
  return report;
}
