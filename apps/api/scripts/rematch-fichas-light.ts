// Lightweight ficha re-match: uses the STORED parsed_payload (no snapshot,
// no OneDrive download) → matchPatientForRecord → refresh match_candidates,
// and auto-approve when a ≥0.9 match now exists (thanks to the enriched
// Doctoralia patient pool). Idempotent: only touches PENDING/ERROR rows.
//   node --env-file=.env scripts/rematch-fichas-light.ts
import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { approveClinicalRecordImport } from "../src/services/clinical-record-imports.ts";
import { matchPatientForRecord } from "../src/modules/clinical-records/match.ts";
import type { ParsedClinicalRecord } from "../src/modules/clinical-records/parser.ts";

const REVIEWED_BY = 5; // Lucas (owner) — audit actor for the auto-rematch pass.

const rows = await sql<{ id: string; parsedPayload: ParsedClinicalRecord | null }>`
  SELECT id, parsed_payload AS "parsedPayload"
  FROM clinical_record_imports
  WHERE status IN ('PENDING_REVIEW', 'ERROR') AND parsed_payload IS NOT NULL
  ORDER BY id
`.execute(kysely);

let imported = 0;
let refreshed = 0;
let error = 0;
let done = 0;
const total = rows.rows.length;

async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

await pool(rows.rows, 16, async (row) => {
  try {
    if (!row.parsedPayload) return;
    const match = await matchPatientForRecord(row.parsedPayload);
    await sql`
      UPDATE clinical_record_imports
      SET match_candidates = ${JSON.stringify(match.candidates)}::jsonb, updated_at = now()
      WHERE id = ${row.id}
    `.execute(kysely);
    refreshed += 1;
    if (match.matchedPatientId) {
      await approveClinicalRecordImport(row.id, match.matchedPatientId, REVIEWED_BY, "auto-rematch doctoralia");
      imported += 1;
    }
  } catch {
    error += 1;
  }
  done += 1;
  if (done % 1000 === 0) console.log(`  ${done}/${total} · imported=${imported} refreshed=${refreshed}`);
});

console.log(JSON.stringify({ total, imported, refreshed, error }, null, 2));
process.exit(0);
