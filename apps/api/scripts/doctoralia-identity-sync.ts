// Runner for the Doctoralia identity feeder.
//   node --env-file=.env scripts/doctoralia-identity-sync.ts          # dry-run (default)
//   node --env-file=.env scripts/doctoralia-identity-sync.ts --write  # apply
import { runDoctoraliaIdentitySync } from "../src/services/doctoralia-identity-sync.ts";

const dryRun = !process.argv.includes("--write");
const result = await runDoctoraliaIdentitySync({ dryRun });
console.log(JSON.stringify(result, null, 2));
process.exit(0);
