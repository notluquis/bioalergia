/**
 * Importa correos .eml desde un directorio de backup al servidor IMAP (Spacemail).
 *
 * Estructura esperada del backup:
 *   <backupDir>/
 *     lpulgar/
 *       INBOX/  1_Asunto.eml  ...
 *       Sent/   ...
 *     jmartinez/
 *       ...
 *
 * Uso:
 *   pnpm --filter @finanzas/local-mail-agent import:eml /ruta/al/backup
 *   pnpm --filter @finanzas/local-mail-agent import:eml /ruta/al/backup --dry-run
 *   pnpm --filter @finanzas/local-mail-agent import:eml /ruta/al/backup --account lpulgar
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { MultiBar, Presets } from "cli-progress";
import { ImapFlow } from "imapflow";
import { readKeychainSecret } from "../keychain";

// ─── Config ───────────────────────────────────────────────────────────────────

const IMAP_HOST = process.env.LOCAL_AGENT_IMAP_HOST ?? "mail.spacemail.com";
const IMAP_PORT = Number.parseInt(process.env.LOCAL_AGENT_IMAP_PORT ?? "993", 10);
const IMAP_SECURE = process.env.LOCAL_AGENT_IMAP_SECURE !== "0";
const IMPORT_SERVICE = "bioalergia-mail-import";
const CONCURRENCY = 8;

const FOLDER_MAP: Record<string, string> = {
  INBOX: "INBOX", Inbox: "INBOX", inbox: "INBOX",
  Sent: "Sent", sent: "Sent", "Sent Items": "Sent", "Sent Messages": "Sent",
  Spam: "Spam", spam: "Spam", Junk: "Spam", "Junk Email": "Spam",
  Trash: "Trash", trash: "Trash", Deleted: "Trash", "Deleted Items": "Trash",
  Drafts: "Drafts", drafts: "Drafts", Scheduled: "Drafts",
};

const ACCOUNT_MAP: Record<string, string> = {
  lpulgar: "lpulgar@bioalergia.cl",
  jmartinez: "jmartinez@bioalergia.cl",
  finanzas: "contacto@bioalergia.cl",
  contacto: "contacto@bioalergia.cl",
  clinica: "clinica@bioalergia.cl",
};

// ─── CLI ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const backupDir = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const onlyAccount = args.find((_, i) => args[i - 1] === "--account");

if (!backupDir) {
  console.error("Uso: tsx import-eml-backup.ts <backupDir> [--dry-run] [--account <nombre>]");
  process.exit(1);
}
const resolvedBackupDir: string = backupDir;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isDir(p: string) {
  try { return (await stat(p)).isDirectory(); } catch { return false; }
}

async function listSubdirs(dir: string) {
  const entries = await readdir(dir);
  const result: string[] = [];
  for (const e of entries) if (await isDir(join(dir, e))) result.push(e);
  return result;
}

async function listEmlFiles(dir: string) {
  const entries = await readdir(dir);
  return entries.filter((e) => e.toLowerCase().endsWith(".eml")).map((e) => join(dir, e));
}

function parseHeaders(raw: Buffer): string {
  const headerEnd = raw.indexOf("\r\n\r\n");
  return raw.subarray(0, headerEnd > 0 ? headerEnd : Math.min(8192, raw.length)).toString("latin1");
}

function extractEmailDate(headers: string, emlPath: string): Date {
  const match = headers.match(/^Date:\s*(.+)$/im);
  if (match) {
    const d = new Date(match[1].trim());
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Loggear cuáles fallan para poder revisarlos
  const filename = emlPath.split("/").pop() ?? emlPath;
  console.error(`  ⚠ Sin fecha válida: ${filename} — usando fecha actual`);
  return new Date();
}

/** Extrae las flags IMAP preservando el estado leído/no leído del .eml original.
 *  El header Status: R o RO → \Seen; cualquier otra cosa → sin flag (no leído).
 */
function extractFlags(headers: string): string[] {
  const match = headers.match(/^Status:\s*(.+)$/im);
  if (match && match[1].toUpperCase().includes("R")) return ["\\Seen"];
  return [];
}

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

function pad(s: string, n: number) {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

// ─── Import one account (runs in parallel with other accounts) ────────────────

interface FolderResult {
  label: string;
  total: number;
  ok: number;
  errors: number;
}

interface AccountResult {
  account: string;
  imapUser: string;
  folders: FolderResult[];
  skipped?: boolean;
}

async function importAccount(
  accountName: string,
  accountDir: string,
  multibar: MultiBar,
): Promise<AccountResult> {
  const imapUser = ACCOUNT_MAP[accountName] ?? `${accountName}@bioalergia.cl`;

  let imapPass: string;
  try {
    imapPass = await readKeychainSecret(IMPORT_SERVICE, imapUser);
  } catch {
    multibar.log(`✗ ${accountName}: contraseña no encontrada en Keychain.\n`);
    return { account: accountName, imapUser, folders: [], skipped: true };
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: imapUser, pass: imapPass },
    logger: false,
  });

  try {
    await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    multibar.log(`✗ ${accountName} (${imapUser}): ${msg}\n`);
    return { account: accountName, imapUser, folders: [], skipped: true };
  }

  // Resolve server folder names
  const serverFolders = await client.list();
  const serverPaths = new Set(serverFolders.map((f) => f.path));

  async function resolveFolder(name: string): Promise<string> {
    const mapped = FOLDER_MAP[name] ?? name;
    if (serverPaths.has(mapped)) return mapped;
    const ci = [...serverPaths].find((p) => p.toLowerCase() === mapped.toLowerCase());
    if (ci) return ci;
    if (!dryRun) {
      try {
        await client.mailboxCreate(mapped);
        serverPaths.add(mapped);
      } catch {
        return "INBOX";
      }
    }
    return mapped;
  }

  const folderNames = await listSubdirs(accountDir);
  const folderResults: FolderResult[] = [];

  for (const folderName of folderNames) {
    const emlFiles = await listEmlFiles(join(accountDir, folderName));
    if (emlFiles.length === 0) continue;

    const imapFolder = await resolveFolder(folderName);
    const label = `${pad(accountName, 10)} ${pad(folderName, 10)} → ${imapFolder}`;

    if (dryRun) {
      multibar.log(`  [dry-run] ${label}: ${emlFiles.length} correos\n`);
      folderResults.push({ label, total: emlFiles.length, ok: 0, errors: 0 });
      continue;
    }

    let ok = 0;
    let errors = 0;
    const startMs = Date.now();

    const bar = multibar.create(emlFiles.length, 0, {
      label,
      ok,
      errors,
      rate: "0/s",
      eta: "?",
    });

    const tasks = emlFiles.map((emlPath) => async () => {
      try {
        const raw = await readFile(emlPath);
        const headers = parseHeaders(raw);
        const flags = extractFlags(headers);
        const date = extractEmailDate(headers, emlPath);
        await client.append(imapFolder, raw, flags, date);
        ok++;
      } catch {
        errors++;
      }
      const elapsed = (Date.now() - startMs) / 1000;
      const done = ok + errors;
      const rate = elapsed > 0 ? (done / elapsed).toFixed(1) : "0";
      const remaining = emlFiles.length - done;
      const etaSecs = elapsed > 0 && done > 0 ? Math.round((remaining * elapsed) / done) : 0;
      const eta = etaSecs > 60 ? `${Math.round(etaSecs / 60)}m` : `${etaSecs}s`;
      bar.update(done, { ok, errors, rate: `${rate}/s`, eta });
    });

    await pLimit(tasks, CONCURRENCY);
    bar.update(emlFiles.length, { ok, errors, rate: "-", eta: "done" });

    folderResults.push({ label, total: emlFiles.length, ok, errors });
  }

  await client.logout().catch(() => undefined);
  return { account: accountName, imapUser, folders: folderResults };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const accountDirs = await listSubdirs(resolvedBackupDir);
  const filtered = onlyAccount ? accountDirs.filter((a) => a === onlyAccount) : accountDirs;

  if (filtered.length === 0) {
    console.error("No se encontraron cuentas.");
    process.exit(1);
  }

  const totalEmails = await (async () => {
    let n = 0;
    for (const acc of filtered) {
      const folders = await listSubdirs(join(resolvedBackupDir, acc));
      for (const folder of folders) n += (await listEmlFiles(join(resolvedBackupDir, acc, folder))).length;
    }
    return n;
  })();

  console.log(`\n=== Importación EML Backup ===`);
  console.log(`Directorio : ${resolvedBackupDir}`);
  console.log(`Cuentas    : ${filtered.join(", ")}`);
  console.log(`Total      : ${totalEmails} correos`);
  if (dryRun) console.log(`Modo       : DRY-RUN — no se escribe en IMAP`);
  console.log("");

  const multibar = new MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      stopOnComplete: false,
      noTTYOutput: false,
      format:
        "  {label} [{bar}] {value}/{total} {percentage}%  ✓{ok} ✗{errors}  {rate}  ETA {eta}",
      barsize: 28,
    },
    Presets.shades_grey,
  );

  // Todas las cuentas en paralelo
  const results = await Promise.all(
    filtered.map((acc) => importAccount(acc, join(resolvedBackupDir, acc), multibar)),
  );

  multibar.stop();

  // ─── Resumen ──────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════");
  console.log("RESUMEN");
  console.log("═══════════════════════════════════════\n");

  let totalOk = 0;
  let totalErrors = 0;

  for (const r of results) {
    if (r.skipped) {
      console.log(`✗ ${r.account} — saltada (error de autenticación)`);
      continue;
    }
    if (r.folders.length === 0) {
      console.log(`  ${r.account} — sin correos`);
      continue;
    }
    console.log(`✓ ${r.account} (${r.imapUser})`);
    for (const f of r.folders) {
      if (dryRun) {
        console.log(`    ${f.label}: ${f.total} a importar`);
      } else {
        const status = f.errors > 0 ? `✓${f.ok} ✗${f.errors}` : `✓${f.ok}`;
        console.log(`    ${f.label}: ${f.total} → ${status}`);
        totalOk += f.ok;
        totalErrors += f.errors;
      }
    }
  }

  console.log("");
  if (dryRun) {
    console.log(`Total: ${totalEmails} correos listos para importar`);
  } else {
    const icon = totalErrors === 0 ? "✓" : "⚠";
    console.log(`${icon} Total: ${totalOk} importados, ${totalErrors} errores`);
  }
  console.log("");
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
