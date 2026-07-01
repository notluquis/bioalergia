// Resolve DTE boleta client RUTs into Person (titular) + populate the
// patient_dte_sale_sources bridge, stamping patientId when the titular is
// already a patient. Companies are skipped.
//   node --env-file=.env scripts/backfill-dte-titulares.ts          # dry-run
//   node --env-file=.env scripts/backfill-dte-titulares.ts --write  # apply
import { syncPatientDteSaleSources } from "../src/services/patients-router.ts";

const dryRun = !process.argv.includes("--write");
const result = await syncPatientDteSaleSources({ dryRun, resolveTitular: true });
console.log(JSON.stringify(result, null, 2));
process.exit(0);
