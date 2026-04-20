import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../../packages/db/.env") });

// One-shot migration for appointments/work periods whose start_at/end_at were
// written by a Node process in UTC while the source string was naive Chile
// local time. We interpret the wall-clock value AS IF it were Chile local and
// re-store it as UTC (which is what the column has always meant — it's declared
// `timestamp without time zone` but the database session runs in UTC).
//
// PostgreSQL semantics:
//   (naive_timestamp) AT TIME ZONE 'America/Santiago' → timestamptz
//     (interprets the naive value as Chile wall clock)
//   (that timestamptz) AT TIME ZONE 'UTC' → naive timestamp
//     (renders the moment as UTC wall clock)
// Net effect: shift by +4h (or +3h during DST if applicable).
//
// Run with: `pnpm --filter @finanzas/api exec tsx src/scripts/fix-doctoralia-timezone.ts`
// NOT idempotent: re-running would shift the same rows a second time.

const TARGETS: Array<{ table: string; columns: string[] }> = [
  {
    table: "doctoralia_calendar_appointments",
    columns: ["start_at", "end_at", "patient_birth_date", "patient_arrival_time"],
  },
  { table: "doctoralia_work_periods", columns: ["start_at", "end_at"] },
  { table: "doctoralia_bookings", columns: ["start_at", "end_at", "booked_at", "canceled_at"] },
  { table: "doctoralia_calendar_breaks", columns: ["since", "till"] },
];

async function main() {
  const { db } = await import("@finanzas/db");
  const dryRun = process.argv.includes("--dry-run");

  console.log(`${dryRun ? "[DRY RUN] " : ""}Shifting Doctoralia timestamps by Chile offset...`);

  for (const { table, columns } of TARGETS) {
    const assignments = columns
      .map(
        (col) =>
          `"${col}" = ("${col}" AT TIME ZONE 'America/Santiago' AT TIME ZONE 'UTC')`,
      )
      .join(", ");
    const nullGuard = columns.map((col) => `"${col}" IS NOT NULL`).join(" OR ");
    const sql = `UPDATE "${table}" SET ${assignments} WHERE ${nullGuard}`;

    if (dryRun) {
      console.log(`[DRY RUN] would run: ${sql}`);
      continue;
    }

    console.log(`Updating ${table} (${columns.join(", ")})...`);
    const rows = await db.$executeRawUnsafe(sql);
    console.log(`  ${rows} rows updated.`);
  }

  console.log("Done. Verify a known appointment against Doctoralia's web UI before trusting.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
