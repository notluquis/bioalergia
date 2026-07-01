// READ-ONLY: run the (now fuzzy) matcher over PENDING fichas and report how
// many would auto-import, with a sample of ficha-name → matched-candidate so
// false positives can be eyeballed BEFORE any write. No DB mutation.
import { kysely } from "@finanzas/db";
import { sql } from "kysely";
import { matchPatientForRecord } from "../src/modules/clinical-records/match.ts";
import type { ParsedClinicalRecord } from "../src/modules/clinical-records/parser.ts";

const rows = await sql<{ id: string; parsedPayload: ParsedClinicalRecord | null }>`
  SELECT id, parsed_payload AS "parsedPayload"
  FROM clinical_record_imports
  WHERE status = 'PENDING_REVIEW' AND coalesce(parsed_payload->>'patientName','') <> ''
  ORDER BY id
`.execute(kysely);

let autoMatch = 0;
const samples: string[] = [];
let done = 0;

async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

await pool(rows.rows, 16, async (row) => {
  if (!row.parsedPayload) return;
  const m = await matchPatientForRecord(row.parsedPayload);
  if (m.matchedPatientId) {
    autoMatch += 1;
    const top = m.candidates[0];
    if (samples.length < 40 && top) {
      samples.push(`"${(row.parsedPayload.patientName || "").trim()}" -> "${top.fullName}" (${top.score}) ${top.reason}`);
    }
  }
  done += 1;
});

console.log(`PENDING con nombre: ${rows.rows.length} · auto-match (fuzzy): ${autoMatch}\n`);
console.log(samples.join("\n"));
process.exit(0);
