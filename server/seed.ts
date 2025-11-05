import { getPool, seedDefaultAdmin, seedDefaultSettings } from "./db.js";
import { runMigrations } from "./migrationRunner.js";
import { logger } from "./lib/logger.js";

async function seed() {
  await runMigrations();
  const pool = getPool();

  await seedDefaultSettings(pool);
  await seedDefaultAdmin(pool);

  logger.info("Seed completed");
}

seed().catch((error) => {
  logger.error({ error }, "Seed failed");
  process.exit(1);
});
