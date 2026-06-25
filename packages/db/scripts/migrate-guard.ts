#!/usr/bin/env node
/**
 * migrate-guard — salvaguarda PRE-deploy de migraciones (full ZenStack).
 *
 * Objetivo: "deploy SIEMPRE, pero nunca destructivo por sorpresa". Este guard
 * NO toca la DB; analiza estáticamente las migraciones en disco y aborta el
 * deploy si detecta riesgo. Pensado para correr antes de `zen migrate deploy`.
 *
 * Qué bloquea (exit 1):
 *   1. SQL DESTRUCTIVO (DROP TABLE / DROP COLUMN / TRUNCATE / DELETE /
 *      ALTER ... DROP ...) en una migración que NO esté marcada como revisada.
 *      Para permitir una migración destructiva legítima, agrega como PRIMERA
 *      línea del migration.sql:  `-- SAFE-DESTRUCTIVE: <razón + fecha + autor>`
 *   2. Colisiones de timestamp (dos migraciones con el mismo prefijo): el orden
 *      de aplicación queda ambiguo. Renombra una con un timestamp posterior.
 *
 * Qué advierte (no bloquea):
 *   - Migraciones aditivas (CREATE/ADD/INDEX) sin `IF NOT EXISTS` → no son
 *     idempotentes; si prod tiene drift (db push histórico) pueden fallar al
 *     re-aplicar. Regla del repo: aditivo + idempotente.
 *
 * Alcance: solo evalúa migraciones PENDIENTES (en disco pero no aplicadas en
 * prod). Las ya aplicadas son historia inmutable que `migrate deploy` no vuelve
 * a correr, así que no tiene sentido bloquearlas. Para saber cuáles están
 * aplicadas consulta `_prisma_migrations` vía psql usando DATABASE_URL del
 * .env (read-only). Si no hay DB disponible (p.ej. CI sin secreto), cae a un
 * baseline file `zenstack/migrations/.guard-baseline` (todo lo <= baseline se
 * considera aplicado) y, si tampoco existe, chequea todas con un aviso.
 *
 * Uso:
 *   pnpm migrate:guard           # chequea solo pendientes
 *   node scripts/migrate-guard.ts --all       # fuerza chequear todas
 *   node scripts/migrate-guard.ts --strict    # warnings -> error
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(import.meta.dirname, "..", "zenstack", "migrations");
const BASELINE_FILE = join(MIGRATIONS_DIR, ".guard-baseline");
const STRICT = process.argv.includes("--strict");
const CHECK_ALL = process.argv.includes("--all");

function readDatabaseUrl(): string | null {
  // 1) env del proceso (Railway / CI ya la tienen).
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.split("?")[0];
  }
  // 2) .env locales (worktree actual y hermanos comunes).
  const candidates = [
    join(import.meta.dirname, "../.env"),
    join(import.meta.dirname, "../../apps/api/.env"),
  ];
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    candidates.push(join(root, "packages/db/.env"), join(root, "apps/api/.env"));
  } catch {
    // sin git, ignora
  }
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const line = readFileSync(p, "utf8")
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL="));
    if (line) {
      const raw = line
        .slice("DATABASE_URL=".length)
        .trim()
        .replace(/^["']|["']$/g, "");
      return raw.split("?")[0]; // psql no acepta query params tipo pool_timeout
    }
  }
  return null;
}

/** Devuelve el set de migraciones aplicadas+sanas en prod, o null si no se pudo. */
function appliedMigrations(): Set<string> | null {
  const url = readDatabaseUrl();
  if (!url) return null;
  try {
    const out = execFileSync(
      "psql",
      [
        url,
        "-tA",
        "-c",
        "select migration_name from _prisma_migrations group by migration_name having bool_or(finished_at is not null and rolled_back_at is null);",
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return new Set(
      out
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean)
    );
  } catch {
    return null;
  }
}

/** Migraciones consideradas "ya aplicadas" según el baseline file (fallback). */
function baselineApplied(all: string[]): Set<string> | null {
  if (!existsSync(BASELINE_FILE)) return null;
  const baseline = readFileSync(BASELINE_FILE, "utf8").trim();
  if (!baseline) return null;
  return new Set(all.filter((m) => m <= baseline));
}

// Patrones realmente destructivos (borran datos/estructura existente).
const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /^\s*DELETE\s+FROM\b/im,
  /\bALTER\s+TABLE\b[\s\S]*?\bDROP\s+(COLUMN|CONSTRAINT)\b/i,
  /\bDROP\s+TYPE\b/i,
];

// Aditivo: candidato a requerir IF NOT EXISTS para ser idempotente.
const ADDITIVE = [/\bCREATE\s+TABLE\b/i, /\bADD\s+COLUMN\b/i, /\bCREATE\s+(UNIQUE\s+)?INDEX\b/i];

const SAFE_MARKER = /--\s*SAFE-DESTRUCTIVE:/i;

type Finding = { migration: string; kind: "block" | "warn"; message: string };

function listMigrations(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(MIGRATIONS_DIR);
  } catch {
    console.error(`migrate-guard: no encontré ${MIGRATIONS_DIR}`);
    process.exit(1);
  }
  return entries
    .filter((name) => {
      const full = join(MIGRATIONS_DIR, name);
      return statSync(full).isDirectory() && name !== "manual-sql";
    })
    .sort();
}

function checkTimestampCollisions(migrations: string[]): Finding[] {
  const byTs = new Map<string, string[]>();
  for (const m of migrations) {
    const ts = m.split("_")[0];
    if (!ts || !/^\d{14}$/.test(ts)) continue;
    const arr = byTs.get(ts) ?? [];
    arr.push(m);
    byTs.set(ts, arr);
  }
  const findings: Finding[] = [];
  for (const [ts, group] of byTs) {
    if (group.length > 1) {
      findings.push({
        migration: group.join(", "),
        kind: "warn",
        message: `Colisión de timestamp ${ts}: ${group.length} migraciones comparten prefijo. El orden de aplicación es ambiguo; renombra una con un timestamp posterior.`,
      });
    }
  }
  return findings;
}

function checkSql(migration: string): Finding[] {
  const sqlPath = join(MIGRATIONS_DIR, migration, "migration.sql");
  let sql: string;
  try {
    sql = readFileSync(sqlPath, "utf8");
  } catch {
    return [{ migration, kind: "warn", message: "No tiene migration.sql legible." }];
  }

  const findings: Finding[] = [];
  const isMarkedSafe = SAFE_MARKER.test(sql);

  const hits = DESTRUCTIVE.filter((re) => re.test(sql));
  if (hits.length > 0 && !isMarkedSafe) {
    findings.push({
      migration,
      kind: "block",
      message: `Contiene SQL DESTRUCTIVO (${hits.length} patrón/es) sin marca de revisión. Si es intencional, agrega como primera línea: \`-- SAFE-DESTRUCTIVE: <razón, fecha, autor>\`.`,
    });
  }

  const additive = ADDITIVE.some((re) => re.test(sql));
  if (additive && !/IF\s+NOT\s+EXISTS/i.test(sql)) {
    findings.push({
      migration,
      kind: "warn",
      message:
        "Tiene CREATE/ADD/INDEX sin `IF NOT EXISTS` → no es idempotente (riesgo de fallo al re-aplicar sobre prod con drift).",
    });
  }

  return findings;
}

function main(): void {
  const all = listMigrations();

  let pending = all;
  let scopeNote = "todas (forzado con --all)";
  if (!CHECK_ALL) {
    const applied = appliedMigrations() ?? baselineApplied(all);
    if (applied) {
      pending = all.filter((m) => !applied.has(m));
      scopeNote = `${pending.length} pendiente(s) de ${all.length}`;
    } else {
      scopeNote = "todas (sin DB ni baseline; no se pudo determinar pendientes)";
    }
  }

  // Las colisiones de timestamp se evalúan sobre el set completo (afectan el
  // orden global), pero solo importan si involucran una pendiente.
  const pendingSet = new Set(pending);
  const collisions = checkTimestampCollisions(all).filter((f) =>
    f.migration.split(", ").some((m) => pendingSet.has(m))
  );

  const findings: Finding[] = [...collisions, ...pending.flatMap((m) => checkSql(m))];

  const blocks = findings.filter((f) => f.kind === "block");
  const warns = findings.filter((f) => f.kind === "warn");

  for (const f of warns) {
    console.warn(`⚠  [${f.kind}] ${f.migration}\n   ${f.message}`);
  }
  for (const f of blocks) {
    console.error(`✖  [${f.kind}] ${f.migration}\n   ${f.message}`);
  }

  console.log(
    `\nmigrate-guard: alcance ${scopeNote} · ${blocks.length} bloqueante(s) · ${warns.length} advertencia(s).`
  );

  if (blocks.length > 0 || (STRICT && warns.length > 0)) {
    console.error(
      "\nDeploy ABORTADO. Revisa lo anterior. (Las migraciones aditivas + idempotentes pasan limpio.)"
    );
    process.exit(1);
  }
  console.log("OK: ninguna migración destructiva sin revisar. Deploy permitido.");
}

main();
