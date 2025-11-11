import { backfillCounterpartsFromWithdrawals, ensureDatabaseConnection } from "../server/db.js";

async function main() {
  await ensureDatabaseConnection();
  const result = await backfillCounterpartsFromWithdrawals();
  console.log(`✅ Counterpart backfill completed. Processed ${result.candidates} unique identification numbers.`);
}

main().catch((error) => {
  console.error("❌ Failed to backfill counterparts:", error);
  process.exitCode = 1;
});
