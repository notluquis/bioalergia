#!/usr/bin/env node
// Merge person rows that share the same RUT body but differ in the DV
// digit. Picks the canonical row (DV valid AND most data populated),
// reassigns every FK pointing at the loser, then deletes the loser.
//
// Idempotent: re-running after a successful merge is a no-op since the
// dup group disappears.
//
// Run:
//   DATABASE_URL=... node apps/api/scripts/merge-duplicate-persons-by-rut.ts --dry
//   DATABASE_URL=... node apps/api/scripts/merge-duplicate-persons-by-rut.ts --apply

import { kysely } from "@finanzas/db";
import { sql } from "kysely";

const DRY = !process.argv.includes("--apply");

function computeDv(body: string): string {
  let sum = 0;
  let m = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number.parseInt(body[i], 10) * m;
    m = m === 7 ? 2 : m + 1;
  }
  const r = 11 - (sum % 11);
  if (r === 11) return "0";
  if (r === 10) return "K";
  return String(r);
}

type PersonRow = {
  id: number;
  rut: string;
  names: string;
  fatherName: string | null;
  motherName: string | null;
  email: string | null;
  phone: string | null;
};

function dataScore(p: PersonRow): number {
  let s = 0;
  if (p.email) s += 4;
  if (p.phone) s += 4;
  if (p.fatherName) s += 1;
  if (p.motherName) s += 1;
  if (/[áéíóúñÁÉÍÓÚÑ]/.test(p.names + (p.fatherName ?? "") + (p.motherName ?? ""))) s += 2;
  return s;
}

const FK_TABLES_PERSON = ["addresses", "users", "employees"];

async function fkCountsForPerson(personId: number): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const t of FK_TABLES_PERSON) {
    const r = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c FROM ${sql.id(t)} WHERE person_id = ${personId}
    `.execute(kysely);
    result[t] = Number.parseInt(r.rows[0]?.c ?? "0", 10);
  }
  return result;
}

async function patientIdsForPerson(personId: number): Promise<number[]> {
  const r = await sql<{ id: number }>`
    SELECT id FROM patients WHERE person_id = ${personId}
  `.execute(kysely);
  return r.rows.map((row) => row.id);
}

const FK_TABLES_PATIENT = [
  "clinical_series",
  "consultations",
  "patient_payments",
  "budgets",
  "shipments",
  "medical_certificates",
  "patient_attachments",
  "patient_dte_sale_sources",
];

async function reassignPatientChildren(fromPatientId: number, toPatientId: number): Promise<void> {
  for (const t of FK_TABLES_PATIENT) {
    await sql`UPDATE ${sql.id(t)} SET patient_id = ${toPatientId} WHERE patient_id = ${fromPatientId}`.execute(
      kysely
    );
  }
}

async function reassignPersonChildren(fromPersonId: number, toPersonId: number): Promise<void> {
  for (const t of FK_TABLES_PERSON) {
    await sql`UPDATE ${sql.id(t)} SET person_id = ${toPersonId} WHERE person_id = ${fromPersonId}`.execute(
      kysely
    );
  }
}

async function purgeEmptyClinicalSeries(patientId: number): Promise<number> {
  const r = await sql<{ id: number }>`
    SELECT cs.id
    FROM clinical_series cs
    LEFT JOIN clinical_skin_tests t ON t.clinical_series_id = cs.id
    LEFT JOIN events e ON e.clinical_series_id = cs.id
    WHERE cs.patient_id = ${patientId}
    GROUP BY cs.id
    HAVING COUNT(t.id) = 0 AND COUNT(e.id) = 0
  `.execute(kysely);
  for (const row of r.rows) {
    await sql`DELETE FROM clinical_series WHERE id = ${row.id}`.execute(kysely);
  }
  return r.rows.length;
}

async function patientIsEmpty(patientId: number): Promise<boolean> {
  for (const t of FK_TABLES_PATIENT) {
    const r = await sql<{ c: string }>`
      SELECT COUNT(*)::text AS c FROM ${sql.id(t)} WHERE patient_id = ${patientId}
    `.execute(kysely);
    if (Number.parseInt(r.rows[0]?.c ?? "0", 10) > 0) return false;
  }
  return true;
}

async function main() {
  const groups = await sql<{ body: string; ids: string }>`
    SELECT regexp_replace(rut, '-[0-9K]$', '') AS body,
           string_agg(id::text, ',' ORDER BY id) AS ids
    FROM people
    WHERE rut ~ '^[0-9]+-[0-9K]$'
    GROUP BY body
    HAVING COUNT(*) > 1
  `.execute(kysely);

  console.log(`[${DRY ? "DRY" : "APPLY"}] ${groups.rows.length} dup groups`);
  let merged = 0;
  let skipped = 0;

  for (const g of groups.rows) {
    const ids = g.ids.split(",").map((s) => Number.parseInt(s, 10));
    const persons = await sql<PersonRow>`
      SELECT id, rut,
             names,
             father_name AS "fatherName",
             mother_name AS "motherName",
             email,
             phone
      FROM people
      WHERE id = ANY(${ids})
      ORDER BY id
    `.execute(kysely);
    const validDv = computeDv(g.body);
    const ranked = persons.rows
      .map((p) => ({
        p,
        dvOk: p.rut.endsWith(`-${validDv}`),
        score: dataScore(p),
      }))
      .sort((a, b) => {
        if (a.dvOk !== b.dvOk) return a.dvOk ? -1 : 1;
        if (a.score !== b.score) return b.score - a.score;
        return a.p.id - b.p.id;
      });
    const winner = ranked[0].p;
    const losers = ranked.slice(1).map((r) => r.p);
    console.log(
      `\nbody=${g.body} validDV=${validDv}`,
      `WINNER ${winner.id}=${winner.rut} (${winner.names} ${winner.fatherName ?? ""})`,
      `LOSERS ${losers.map((l) => `${l.id}=${l.rut}`).join(", ")}`
    );

    if (DRY) {
      skipped += losers.length;
      continue;
    }

    for (const loser of losers) {
      // Detect collisions: if loser has a user/employee link the merge
      // is unsafe — skip + emit warning.
      const fk = await fkCountsForPerson(loser.id);
      if (fk.users > 0 || fk.employees > 0) {
        console.warn(`  SKIP ${loser.id}: linked to user/employee`, fk);
        continue;
      }
      // Reassign per-person FKs first.
      await reassignPersonChildren(loser.id, winner.id);
      // Reassign per-patient FKs: every patient on the loser becomes
      // the winner's existing patient (if any) or migrates the patient
      // row itself to point at the winner.
      const winnerPatients = await patientIdsForPerson(winner.id);
      const winnerPatientId = winnerPatients[0] ?? null;
      const loserPatients = await patientIdsForPerson(loser.id);
      for (const lp of loserPatients) {
        if (winnerPatientId) {
          await reassignPatientChildren(lp, winnerPatientId);
          await purgeEmptyClinicalSeries(lp);
          if (await patientIsEmpty(lp)) {
            await sql`DELETE FROM patients WHERE id = ${lp}`.execute(kysely);
          }
        } else {
          // Winner has no patient row; transplant loser's patient onto winner.
          await sql`UPDATE patients SET person_id = ${winner.id} WHERE id = ${lp}`.execute(kysely);
        }
      }
      // Merge data fields back onto winner if winner is missing them.
      await sql`
        UPDATE people SET
          names = CASE WHEN ${winner.names} = '' THEN ${loser.names} ELSE names END,
          father_name = COALESCE(father_name, ${loser.fatherName}),
          mother_name = COALESCE(mother_name, ${loser.motherName}),
          email = COALESCE(email, ${loser.email}),
          phone = COALESCE(phone, ${loser.phone})
        WHERE id = ${winner.id}
      `.execute(kysely);
      // Finally drop loser.
      await sql`DELETE FROM people WHERE id = ${loser.id}`.execute(kysely);
      merged += 1;
      console.log(`  merged ${loser.id} → ${winner.id}`);
    }
  }

  console.log(`\nDone. merged=${merged} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
