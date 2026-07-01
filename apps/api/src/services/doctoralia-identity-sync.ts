import { db, kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logEvent } from "../lib/logger.ts";
import { validateRut } from "../lib/rut.ts";
import { resolvePerson } from "./identity-resolver.ts";

// ---------------------------------------------------------------------------
// Doctoralia identity feeder — turns calendar appointments into resolved
// Person/Patient rows. Doctoralia is the richest contact source we have
// (phone ~100%, email 97%, birthDate 33%) but an island: appointments carry
// only patient_external_id, name in `title`, and RUT sometimes buried in
// free-text `comments`. This feeder resolves each unique patient and links
// every appointment via appointment.patient_id.
// ---------------------------------------------------------------------------

// RUT in comments MUST carry the dash before the DV, e.g. "25222151-4" or
// "27055685-k". Bare 9-digit numbers (phones like 273330909) are NOT matched
// — otherwise a phone that happens to pass mod-11 would poison identity.
const RUT_IN_TEXT = /\b(\d{1,2}\.?\d{3}\.?\d{3})-([\dkK])\b/;

export function extractRutFromComments(comments: string | null | undefined): string | null {
  if (!comments) return null;
  const m = comments.match(RUT_IN_TEXT);
  if (!m) return null;
  const candidate = `${m[1]}-${m[2]}`;
  return validateRut(candidate) ? candidate : null;
}

export type SplitName = { names: string; fatherName: string | null; motherName: string | null };

// Chilean convention: last two tokens = apellidos, the rest = given names.
// 2 tokens → 1 apellido. Best-effort; the raw `title` stays on the appointment
// and `doctoraliaExternalId` (not the name) is the identity key, so an
// imperfect split never causes a mismatch — it only affects display.
export function splitChileanName(title: string): SplitName {
  const tokens = title.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { names: "", fatherName: null, motherName: null };
  if (tokens.length === 1) return { names: tokens[0], fatherName: null, motherName: null };
  if (tokens.length === 2) return { names: tokens[0], fatherName: tokens[1], motherName: null };
  return {
    names: tokens.slice(0, tokens.length - 2).join(" "),
    fatherName: tokens[tokens.length - 2],
    motherName: tokens[tokens.length - 1],
  };
}

type ApptIdentityRow = {
  patientExternalId: number;
  title: string;
  comments: string | null;
  patientBirthDate: Date | null;
  patientPhone: string | null;
  patientEmail: string | null;
};

export type DoctoraliaSyncResult = {
  dryRun: boolean;
  uniquePatients: number;
  created: number;
  linked: number;
  review: number;
  withRut: number;
  appointmentsLinked: number;
  errors: number;
};

// Bounded-concurrency map — Railway proxy latency makes the sequential loop
// ~hours; running ~10 patients in flight cuts wall time ~10×. Each task is
// independent (distinct patients), so ordering does not matter.
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export async function runDoctoraliaIdentitySync(
  opts: { dryRun?: boolean; onlyUnlinked?: boolean } = {}
): Promise<DoctoraliaSyncResult> {
  const dryRun = opts.dryRun ?? true;
  // Incremental mode: only patients that still have an unlinked appointment
  // (patient_id IS NULL) — i.e. new arrivals. Used by the event-driven hook so
  // the nightly/on-sync pass is O(new) instead of O(all 3.8k).
  const unlinkedFilter = opts.onlyUnlinked ? sql`AND patient_id IS NULL` : sql``;

  // One row per Doctoralia patient, preferring the record that carries a
  // birthDate, then the most recent.
  const rows = await sql<ApptIdentityRow>`
    SELECT DISTINCT ON (patient_external_id)
      patient_external_id AS "patientExternalId",
      title,
      comments,
      patient_birth_date AS "patientBirthDate",
      patient_phone AS "patientPhone",
      patient_email AS "patientEmail"
    FROM doctoralia_calendar_appointments
    WHERE title IS NOT NULL AND title <> ''
      AND has_patient AND NOT is_block AND NOT fake AND patient_external_id > 0
      ${unlinkedFilter}
    ORDER BY patient_external_id, (patient_birth_date IS NOT NULL) DESC, start_at DESC
  `.execute(kysely);

  const result: DoctoraliaSyncResult = {
    dryRun,
    uniquePatients: rows.rows.length,
    created: 0,
    linked: 0,
    review: 0,
    withRut: 0,
    appointmentsLinked: 0,
    errors: 0,
  };

  const processRow = async (row: ApptIdentityRow): Promise<void> => {
    const rut = extractRutFromComments(row.comments);
    if (rut) result.withRut += 1;
    const { names, fatherName, motherName } = splitChileanName(row.title);
    if (!names) {
      result.review += 1;
      return;
    }

    if (dryRun) {
      if (rut) {
        result.created += 1; // approximation; real run dedups by rut
      } else {
        const existing = await db.person.findUnique({
          where: { doctoraliaExternalId: row.patientExternalId },
          select: { id: true },
        });
        if (existing) result.linked += 1;
        else result.created += 1;
      }
      return;
    }

    const resolved = await resolvePerson(
      {
        rut,
        names,
        fatherName,
        motherName,
        birthDate: row.patientBirthDate,
        phone: row.patientPhone,
        email: row.patientEmail,
        doctoraliaExternalId: row.patientExternalId,
      },
      { createPatient: true }
    );

    if (resolved.action === "created") result.created += 1;
    else if (resolved.action === "linked") result.linked += 1;
    else {
      result.review += 1;
      return;
    }

    if (resolved.patientId) {
      const upd = await sql`
        UPDATE doctoralia_calendar_appointments
        SET patient_id = ${resolved.patientId}, updated_at = now()
        WHERE patient_external_id = ${row.patientExternalId} AND patient_id IS DISTINCT FROM ${resolved.patientId}
      `.execute(kysely);
      result.appointmentsLinked += Number(upd.numAffectedRows ?? 0n);
    }
  };

  // Per-patient try/catch so one poison row (rut race, bad data) never aborts
  // the whole batch — idempotent, so failures are safe to re-run.
  await mapWithConcurrency(rows.rows, dryRun ? 20 : 10, async (row) => {
    try {
      await processRow(row);
    } catch (err) {
      result.errors += 1;
      logEvent("[doctoralia-identity-sync] row error", {
        patientExternalId: row.patientExternalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logEvent("[doctoralia-identity-sync] done", { ...result });
  return result;
}
