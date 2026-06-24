import { db } from "@finanzas/db";
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

async function cleanupOrphanClinicalSeries(execute: boolean, cutoff: Date) {
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
  //
  // The old anti-join (LEFT JOIN ... GROUP BY ... HAVING COUNT(child)=0)
  // is the relation `{ none: {} }` filter; the three child relations are
  // events / skinTests / records on ClinicalSeries.
  const candidates = await db.clinicalSeries.findMany({
    where: {
      kind: { in: ["SKIN_TEST", "PATCH_TEST"] },
      status: { notIn: ["ACTIVE", "PLANNED"] },
      patientRut: null,
      createdAt: { lt: cutoff },
      events: { none: {} },
      skinTests: { none: {} },
      records: { none: {} },
    },
    select: { id: true },
    take: SAFETY_LIMIT,
  });
  if (!execute || candidates.length === 0) {
    return { scanned: candidates.length, deleted: 0 };
  }
  const ids = candidates.map((r) => r.id);
  const { count } = await db.clinicalSeries.deleteMany({ where: { id: { in: ids } } });
  return { scanned: candidates.length, deleted: count };
}

async function cleanupOrphanPatients(execute: boolean, cutoff: Date) {
  // Only patients older than the age threshold and with NO child rows
  // anywhere — a fresh patient created seconds ago by a half-completed
  // form should not vanish before the operator finishes typing.
  //
  // Each LEFT JOIN ... HAVING COUNT(child)=0 in the old anti-join is a
  // `{ none: {} }` relation filter; the eight child relations are
  // clinicalSeries / consultations / payments / budgets / shipments /
  // medicalCertificates / attachments / dteSaleSources on Patient.
  const candidates = await db.patient.findMany({
    where: {
      createdAt: { lt: cutoff },
      clinicalSeries: { none: {} },
      consultations: { none: {} },
      payments: { none: {} },
      budgets: { none: {} },
      shipments: { none: {} },
      medicalCertificates: { none: {} },
      attachments: { none: {} },
      dteSaleSources: { none: {} },
    },
    select: { id: true },
    take: SAFETY_LIMIT,
  });
  if (!execute || candidates.length === 0) {
    return { scanned: candidates.length, deleted: 0 };
  }
  const ids = candidates.map((r) => r.id);
  const { count } = await db.patient.deleteMany({ where: { id: { in: ids } } });
  return { scanned: candidates.length, deleted: count };
}

async function cleanupOrphanPeople(execute: boolean, cutoff: Date) {
  // Same age threshold as patients. Also keep any row carrying a
  // valid RUT — even if every link is gone, a populated RUT is
  // identity evidence the operator may want to merge later.
  //
  // patient / user / employee are nullable to-one relations → `{ is: null }`;
  // addresses is to-many → `{ none: {} }`. Together they replace the old
  // LEFT JOIN ... HAVING COUNT(child)=0 anti-join.
  const candidates = await db.person.findMany({
    where: {
      createdAt: { lt: cutoff },
      rut: null,
      patient: { is: null },
      user: { is: null },
      employee: { is: null },
      addresses: { none: {} },
    },
    select: { id: true },
    take: SAFETY_LIMIT,
  });
  if (!execute || candidates.length === 0) {
    return { scanned: candidates.length, deleted: 0 };
  }
  const ids = candidates.map((r) => r.id);
  const { count } = await db.person.deleteMany({ where: { id: { in: ids } } });
  return { scanned: candidates.length, deleted: count };
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

  // Single shared cutoff for the whole sweep (was an independent `now() -
  // interval '30 days'` per step). Computing it once in JS keeps the three
  // steps consistent and is equivalent within sub-second clock skew.
  const cutoff = new Date(startedAt - AGE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

  try {
    const cs = await cleanupOrphanClinicalSeries(execute, cutoff);
    report.clinicalSeriesScanned = cs.scanned;
    report.clinicalSeriesDeleted = cs.deleted;

    const pa = await cleanupOrphanPatients(execute, cutoff);
    report.patientsScanned = pa.scanned;
    report.patientsDeleted = pa.deleted;

    const pe = await cleanupOrphanPeople(execute, cutoff);
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
