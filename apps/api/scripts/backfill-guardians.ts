// Link Patient.guardianPersonId from series/events beneficiary_rut (payer≠patient).
//   node --env-file=.env scripts/backfill-guardians.ts          # dry-run
//   node --env-file=.env scripts/backfill-guardians.ts --write  # apply
import { runBackfillGuardians } from "../src/services/backfill-guardians.ts";

const dryRun = !process.argv.includes("--write");
const result = await runBackfillGuardians({ dryRun });
console.log(JSON.stringify(result, null, 2));
process.exit(0);
