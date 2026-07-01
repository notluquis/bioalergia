// Backfill clinical_series.patient_id for orphan series.
//   node --env-file=.env scripts/backfill-orphan-series.ts          # dry-run
//   node --env-file=.env scripts/backfill-orphan-series.ts --write  # apply
import { runBackfillOrphanSeries } from "../src/services/backfill-orphan-series.ts";

const dryRun = !process.argv.includes("--write");
const result = await runBackfillOrphanSeries({ dryRun });
console.log(JSON.stringify(result, null, 2));
process.exit(0);
