import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logEvent } from "../lib/logger.ts";
import { validateRut } from "../lib/rut.ts";
import { resolvePerson } from "./identity-resolver.ts";

// ---------------------------------------------------------------------------
// Guardian backfill: the boleta/series RUT is often the PAYER (parent), not the
// patient (child). clinical_series + events carry beneficiary_rut ≠ patient_rut
// for exactly these cases. This links Patient(patient_rut).guardianPersonId to
// the Person(beneficiary_rut) so the payer↔patient relationship is modeled
// instead of only denormalized. Default relationship "apoderado" (generic legal
// guardian) — the source rarely states the exact tie.
// ---------------------------------------------------------------------------

type GuardianPair = {
  patientRut: string;
  beneficiaryRut: string;
  beneficiaryName: string | null;
};

export type BackfillGuardiansResult = {
  dryRun: boolean;
  pairs: number;
  linked: number;
  skippedInvalidRut: number;
  skippedUnresolved: number;
};

export async function runBackfillGuardians(
  opts: { dryRun?: boolean } = {}
): Promise<BackfillGuardiansResult> {
  const dryRun = opts.dryRun ?? true;

  // Distinct (patient, beneficiary) rut pairs from both series and events where
  // the beneficiary differs from the patient.
  const rows = await sql<GuardianPair>`
    SELECT DISTINCT
      regexp_replace(upper(patient_rut), '[^0-9K]', '', 'g') AS "patientRut",
      regexp_replace(upper(beneficiary_rut), '[^0-9K]', '', 'g') AS "beneficiaryRut",
      max(beneficiary_name) AS "beneficiaryName"
    FROM (
      SELECT patient_rut, beneficiary_rut, beneficiary_name FROM clinical_series
      UNION ALL
      SELECT patient_rut, beneficiary_rut, beneficiary_name FROM events
    ) s
    WHERE patient_rut IS NOT NULL AND patient_rut <> ''
      AND beneficiary_rut IS NOT NULL AND beneficiary_rut <> ''
      AND regexp_replace(upper(patient_rut), '[^0-9K]', '', 'g')
          <> regexp_replace(upper(beneficiary_rut), '[^0-9K]', '', 'g')
    GROUP BY 1, 2
  `.execute(kysely);

  const result: BackfillGuardiansResult = {
    dryRun,
    pairs: rows.rows.length,
    linked: 0,
    skippedInvalidRut: 0,
    skippedUnresolved: 0,
  };

  for (const row of rows.rows) {
    if (!validateRut(row.patientRut) || !validateRut(row.beneficiaryRut)) {
      result.skippedInvalidRut += 1;
      continue;
    }
    if (dryRun) {
      result.linked += 1;
      continue;
    }
    // Patient (child) must exist as a Patient; guardian (parent) as a Person.
    const patient = await resolvePerson(
      { rut: row.patientRut, names: row.patientRut },
      { createPatient: true }
    );
    const guardian = await resolvePerson(
      { rut: row.beneficiaryRut, names: row.beneficiaryName ?? row.beneficiaryRut },
      { createPatient: false }
    );
    if (!patient.patientId || !guardian.personId) {
      result.skippedUnresolved += 1;
      continue;
    }
    // Guard on NULL so we never overwrite an operator-set guardian.
    const upd = await sql`
      UPDATE patients
      SET guardian_person_id = ${guardian.personId},
          guardian_relationship = COALESCE(guardian_relationship, 'apoderado'),
          updated_at = now()
      WHERE id = ${patient.patientId} AND guardian_person_id IS NULL
    `.execute(kysely);
    result.linked += Number(upd.numAffectedRows ?? 0n);
  }

  logEvent("[backfill-guardians] done", { ...result });
  return result;
}
