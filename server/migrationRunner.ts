import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Pool } from "mysql2/promise";
import { getPool } from "./db.js";
import { logger } from "./lib/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(191) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
}

async function hasMigration(pool: Pool, filename: string) {
  const [rows] = await pool.query<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM schema_migrations WHERE filename = ?",
    [filename]
  );
  return rows[0]?.count > 0;
}

function splitStatements(sql: string) {
  const cleaned = sql
    .replace(/--.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return cleaned
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function runMigrations() {
  const pool = getPool();
  await ensureMigrationsTable(pool);

  let files: string[] = [];
  try {
    files = await fs.readdir(MIGRATIONS_DIR);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.warn("[migrations] directory not found, skipping");
      return;
    }
    throw error;
  }

  const sqlFiles = files.filter((file) => file.endsWith(".sql")).sort();

  for (const file of sqlFiles) {
    const alreadyApplied = await hasMigration(pool, file);
    if (alreadyApplied) {
      continue;
    }

    const fullPath = path.join(MIGRATIONS_DIR, file);
    const sql = await fs.readFile(fullPath, "utf-8");
    const statements = splitStatements(sql);

    if (!statements.length) {
      logger.warn(`Skipping migration ${file}: no executable statements`);
      await pool.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
      continue;
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const statement of statements) {
        await connection.query(statement);
      }
      await connection.query("INSERT INTO schema_migrations (filename) VALUES (?)", [file]);
      await connection.commit();
      logger.info(`Applied migration ${file}`);
    } catch (error) {
      await connection.rollback();
      logger.error({ error }, `Failed to apply migration ${file}`);
      throw error;
    } finally {
      connection.release();
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      logger.info("Migrations completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, "Migrations failed");
      process.exit(1);
    });
}
