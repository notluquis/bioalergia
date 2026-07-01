import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { logEvent } from "../lib/logger.ts";
import { resolvePerson } from "./identity-resolver.ts";

// ---------------------------------------------------------------------------
// Backfill clinical_series.patient_id for the orphan series that carry
// denormalized patient_name/patient_rut but never got linked to a Patient
// (SKIN_TEST 403, PATCH_TEST 18, SUBCUTANEOUS 7 at time of writing). Routes
// each through the shared resolver: RUT → link/create; name-only → skip
// (left for the ficha-style review flow, never auto-create by name).
// ---------------------------------------------------------------------------

type OrphanSeriesRow = {
  id: number;
  patientName: string | null;
  patientRut: string | null;
};

export type BackfillSeriesResult = {
  dryRun: boolean;
  orphans: number;
  linked: number;
  skippedNoRut: number;
  skippedUnresolved: number;
};

export async function runBackfillOrphanSeries(
  opts: { dryRun?: boolean } = {}
): Promise<BackfillSeriesResult> {
  const dryRun = opts.dryRun ?? true;

  const rows = await sql<OrphanSeriesRow>`
    SELECT id, patient_name AS "patientName", patient_rut AS "patientRut"
    FROM clinical_series
    WHERE patient_id IS NULL AND (patient_rut IS NOT NULL OR patient_name IS NOT NULL)
    ORDER BY id
  `.execute(kysely);

  const result: BackfillSeriesResult = {
    dryRun,
    orphans: rows.rows.length,
    linked: 0,
    skippedNoRut: 0,
    skippedUnresolved: 0,
  };

  for (const row of rows.rows) {
    // Only RUT-bearing series can be resolved safely; name-only would risk a
    // wrong link (homonyms) — leave those for manual review.
    if (!row.patientRut) {
      result.skippedNoRut += 1;
      continue;
    }
    // Dry-run is READ-ONLY: resolvePerson creates rows, so in dry-run we only
    // count RUT-bearing candidates without resolving.
    if (dryRun) {
      result.linked += 1;
      continue;
    }
    const resolved = await resolvePerson(
      { rut: row.patientRut, names: row.patientName ?? row.patientRut },
      { createPatient: true }
    );
    if (!resolved.patientId) {
      result.skippedUnresolved += 1;
      continue;
    }
    result.linked += 1;
    if (!dryRun) {
      await sql`
        UPDATE clinical_series SET patient_id = ${resolved.patientId}, updated_at = now()
        WHERE id = ${row.id} AND patient_id IS NULL
      `.execute(kysely);
    }
  }

  logEvent("[backfill-orphan-series] done", { ...result });
  return result;
}
