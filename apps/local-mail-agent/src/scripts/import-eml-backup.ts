/**
 * Importa correos .eml desde un directorio de backup al servidor IMAP (Spacemail).
 *
 * Estructura esperada del backup:
 *   <backupDir>/
 *     lpulgar/
 *       INBOX/
 *         1_Asunto.eml
 *         27_Otro asunto.eml
 *       Sent/
 *       Spam/
 *       Trash/
 *     jmartinez/
 *       ...
 *
 * Uso:
 *   pnpm exec tsx src/scripts/import-eml-backup.ts /ruta/al/backup
 *   pnpm exec tsx src/scripts/import-eml-backup.ts /ruta/al/backup --dry-run
 *   pnpm exec tsx src/scripts/import-eml-backup.ts /ruta/al/backup --account lpulgar
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ImapFlow } from "imapflow";
import { readKeychainSecret } from "../keychain";

// ─── Configuración ────────────────────────────────────────────────────────────

const IMAP_HOST = process.env.LOCAL_AGENT_IMAP_HOST ?? "mail.spacemail.com";
const IMAP_PORT = Number.parseInt(process.env.LOCAL_AGENT_IMAP_PORT ?? "993", 10);
const IMAP_SECURE = process.env.LOCAL_AGENT_IMAP_SECURE !== "0";
const IMPORT_SERVICE = "bioalergia-mail-import";
const CONCURRENCY = 5; // APPENDs paralelos por carpeta

/**
 * Mapeo: nombre de carpeta en el backup → nombre de carpeta IMAP.
 * Las carpetas no listadas aquí se intentan usar tal cual.
 */
const FOLDER_MAP: Record<string, string> = {
  INBOX: "INBOX",
  Inbox: "INBOX",
  inbox: "INBOX",
  Sent: "Sent",
  sent: "Sent",
  "Sent Items": "Sent",
  "Sent Messages": "Sent",
  Spam: "Spam",
  spam: "Spam",
  Junk: "Spam",
  "Junk Email": "Spam",
  Trash: "Trash",
  trash: "Trash",
  Deleted: "Trash",
  "Deleted Items": "Trash",
  Scheduled: "Drafts",
  Drafts: "Drafts",
  drafts: "Drafts",
};

/**
 * Mapeo: nombre de cuenta en el backup → email IMAP real.
 * finanzas → contacto porque finanzas está routed a contacto.
 */
const ACCOUNT_MAP: Record<string, string> = {
  lpulgar: "lpulgar@bioalergia.cl",
  jmartinez: "jmartinez@bioalergia.cl",
  finanzas: "contacto@bioalergia.cl",
  contacto: "contacto@bioalergia.cl",
  clinica: "clinica@bioalergia.cl",
};

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const backupDir = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const onlyAccount = args.find((_, i) => args[i - 1] === "--account");

if (!backupDir) {
  console.error("Uso: tsx import-eml-backup.ts <backupDir> [--dry-run] [--account <nombre>]");
  process.exit(1);
}
const resolvedBackupDir: string = backupDir;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isDirectory(p: string) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

async function listSubdirs(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const results: string[] = [];
  for (const e of entries) {
    if (await isDirectory(join(dir, e))) results.push(e);
  }
  return results;
}

async function listEmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((e) => e.toLowerCase().endsWith(".eml")).map((e) => join(dir, e));
}

/** Ejecuta tareas con concurrencia limitada */
async function pLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      results[idx] = await tasks[idx]();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return results;
}

// ─── Importación por cuenta ───────────────────────────────────────────────────

interface FolderResult {
  folder: string;
  total: number;
  ok: number;
  skipped: number;
  errors: number;
}

interface AccountResult {
  account: string;
  imapUser: string;
  folders: FolderResult[];
}

async function importAccount(accountName: string, accountDir: string): Promise<AccountResult> {
  const imapUser = ACCOUNT_MAP[accountName] ?? `${accountName}@bioalergia.cl`;
  const label = `[${accountName} → ${imapUser}]`;

  console.log(`\n${label} Conectando...`);

  let imapPass: string;
  try {
    imapPass = await readKeychainSecret(IMPORT_SERVICE, imapUser);
  } catch {
    console.error(`${label} ✗ Contraseña no encontrada en Keychain. Saltando.`);
    console.error(`  → Ejecuta: bash scripts/setup-import-keychain.sh`);
    return { account: accountName, imapUser, folders: [] };
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
  });

  await client.connect();
  console.log(`${label} Conectado.`);

  // Obtener lista de carpetas disponibles en el servidor
  const serverFolders = await client.list();
  const serverFolderPaths = new Set(serverFolders.map((f) => f.path));

  /** Resuelve la carpeta IMAP correcta, creándola si no existe */
  async function resolveImapFolder(backupFolderName: string): Promise<string> {
    const mapped = FOLDER_MAP[backupFolderName] ?? backupFolderName;

    if (serverFolderPaths.has(mapped)) return mapped;

    // Buscar case-insensitive
    const ci = [...serverFolderPaths].find((p) => p.toLowerCase() === mapped.toLowerCase());
    if (ci) return ci;

    // Crear la carpeta si no existe (y no es dry-run)
    if (!dryRun) {
      try {
        await client.mailboxCreate(mapped);
        serverFolderPaths.add(mapped);
        console.log(`  ${label} Carpeta creada: ${mapped}`);
      } catch {
        console.warn(`  ${label} No se pudo crear ${mapped}, usando INBOX como fallback`);
        return "INBOX";
      }
    }
    return mapped;
  }

  const folderNames = await listSubdirs(accountDir);
  const folderResults: FolderResult[] = [];

  for (const folderName of folderNames) {
    const folderDir = join(accountDir, folderName);
    const emlFiles = await listEmlFiles(folderDir);

    if (emlFiles.length === 0) {
      console.log(`  ${label}/${folderName} — sin .eml, saltando`);
      continue;
    }

    const imapFolder = await resolveImapFolder(folderName);
    console.log(
      `  ${label}/${folderName} → ${imapFolder}: ${emlFiles.length} correos${dryRun ? " (dry-run)" : ""}`,
    );

    let ok = 0;
    let skipped = 0;
    let errors = 0;

    if (!dryRun) {
      const tasks = emlFiles.map((emlPath) => async () => {
        try {
          const raw = await readFile(emlPath);
          await client.append(imapFolder, raw, ["\\Seen"], new Date());
          ok++;
          process.stdout.write(".");
        } catch (err) {
          errors++;
          const msg = err instanceof Error ? err.message : String(err);
          process.stdout.write("✗");
          // Guardar detalle del error para el resumen
          console.error(`\n    ✗ ${emlPath}: ${msg}`);
        }
      });

      await pLimit(tasks, CONCURRENCY);
      process.stdout.write("\n");
    } else {
      skipped = emlFiles.length;
    }

    folderResults.push({ folder: `${folderName} → ${imapFolder}`, total: emlFiles.length, ok, skipped, errors });
  }

  await client.logout().catch(() => undefined);
  return { account: accountName, imapUser, folders: folderResults };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== Importación EML Backup ===`);
  console.log(`Directorio: ${backupDir}`);
  if (dryRun) console.log(`MODO DRY-RUN — no se escribirá nada en IMAP`);
  if (onlyAccount) console.log(`Solo cuenta: ${onlyAccount}`);
  console.log("");

  const accountDirs = await listSubdirs(resolvedBackupDir);
  const filtered = onlyAccount ? accountDirs.filter((a) => a === onlyAccount) : accountDirs;

  if (filtered.length === 0) {
    console.error("No se encontraron cuentas en el directorio especificado.");
    process.exit(1);
  }

  const results: AccountResult[] = [];

  for (const accountName of filtered) {
    const accountDir = join(resolvedBackupDir, accountName);
    try {
      const result = await importAccount(accountName, accountDir);
      results.push(result);
    } catch (err) {
      console.error(`[${accountName}] Error fatal:`, err);
      results.push({ account: accountName, imapUser: "", folders: [] });
    }
  }

  // ─── Resumen ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("RESUMEN");
  console.log("═══════════════════════════════════════");

  let totalOk = 0;
  let totalErrors = 0;
  let totalSkipped = 0;

  for (const r of results) {
    if (r.folders.length === 0) {
      console.log(`✗ ${r.account} — sin datos (error de conexión o sin carpetas)`);
      continue;
    }
    console.log(`\n✓ ${r.account} (${r.imapUser})`);
    for (const f of r.folders) {
      const status = dryRun
        ? `${f.skipped} a importar`
        : `${f.ok} OK${f.errors > 0 ? `, ${f.errors} errores` : ""}`;
      console.log(`   ${f.folder}: ${f.total} → ${status}`);
      totalOk += f.ok;
      totalErrors += f.errors;
      totalSkipped += f.skipped;
    }
  }

  console.log("");
  if (dryRun) {
    console.log(`Total a importar: ${totalSkipped} correos`);
  } else {
    console.log(`Total importados: ${totalOk} OK, ${totalErrors} errores`);
  }
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
