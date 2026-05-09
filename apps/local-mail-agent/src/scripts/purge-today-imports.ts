/**
 * Borra del servidor IMAP exactamente los correos que están en el backup,
 * comparando por Message-ID. Solo toca lo que realmente se importó.
 *
 * Uso:
 *   pnpm --filter @finanzas/local-mail-agent purge:today            # dry-run
 *   pnpm --filter @finanzas/local-mail-agent purge:today --delete   # borra de verdad
 *   pnpm --filter @finanzas/local-mail-agent purge:today --account lpulgar
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { ImapFlow } from "imapflow";
import { readKeychainSecret } from "../keychain.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const IMAP_HOST = process.env.LOCAL_AGENT_IMAP_HOST ?? "mail.spacemail.com";
const IMAP_PORT = Number.parseInt(process.env.LOCAL_AGENT_IMAP_PORT ?? "993", 10);
const IMAP_SECURE = process.env.LOCAL_AGENT_IMAP_SECURE !== "0";
const IMPORT_SERVICE = "bioalergia-mail-import";

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
const doDelete = args.includes("--delete");
const onlyAccount = args.find((_, i) => args[i - 1] === "--account");

if (!backupDir) {
  console.error("Uso: tsx purge-today-imports.ts <backupDir> [--delete] [--account <nombre>]");
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

/** Extrae el Message-ID del header de un .eml (solo lee hasta el primer \r\n\r\n) */
function extractMessageId(raw: Buffer): string | null {
  const headerEnd = raw.indexOf("\r\n\r\n");
  const text = raw.subarray(0, headerEnd > 0 ? headerEnd : Math.min(8192, raw.length)).toString("latin1");
  const match = text.match(/^Message-ID:\s*(.+?)(\r?\n(?![ \t])|$)/im);
  if (!match) return null;
  // Normalizar: quitar <> y espacios
  return match[1].trim().replace(/^<|>$/g, "").trim() || null;
}

// ─── Scan backup: Message-IDs por carpeta IMAP ────────────────────────────────

interface FolderBackup {
  imapFolder: string;
  messageIds: Set<string>;
  total: number;
}

async function scanBackupAccount(accountDir: string): Promise<FolderBackup[]> {
  const folderNames = await listSubdirs(accountDir);
  const result: FolderBackup[] = [];

  for (const folderName of folderNames) {
    const imapFolder = FOLDER_MAP[folderName] ?? folderName;
    const emlFiles = await listEmlFiles(join(accountDir, folderName));
    if (emlFiles.length === 0) continue;

    const messageIds = new Set<string>();
    for (const emlPath of emlFiles) {
      const raw = await readFile(emlPath);
      const mid = extractMessageId(raw);
      if (mid) messageIds.add(mid);
    }
    result.push({ imapFolder, messageIds, total: emlFiles.length });
  }

  return result;
}

// ─── Purge one account ────────────────────────────────────────────────────────

async function purgeAccount(accountName: string, backupFolders: FolderBackup[], imapUser: string) {
  let pass: string;
  try {
    pass = await readKeychainSecret(IMPORT_SERVICE, imapUser);
  } catch {
    console.log(`  ${accountName}: sin contraseña en Keychain, saltando`);
    return;
  }

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: IMAP_SECURE,
    auth: { user: imapUser, pass },
    logger: false,
  });

  try {
    await client.connect();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ${accountName}: error de conexión — ${msg}`);
    return;
  }

  for (const { imapFolder, messageIds, total } of backupFolders) {
    if (messageIds.size === 0) continue;

    const lock = await client.getMailboxLock(imapFolder).catch(() => null);
    if (!lock) {
      console.log(`  ${accountName}/${imapFolder}: carpeta no encontrada en servidor`);
      continue;
    }

    try {
      // Si la carpeta está vacía no hay nada que hacer
      const status = await client.status(imapFolder, { messages: true });
      if (!status.messages || status.messages === 0) {
        console.log(`  ${accountName}/${imapFolder}: carpeta vacía en servidor`);
        continue;
      }

      // Traer Message-IDs de todos los mensajes de esta carpeta
      const serverMids = new Map<string, number>(); // messageId → uid
      for await (const msg of client.fetch("1:*", { envelope: true, uid: true })) {
        const mid = msg.envelope?.messageId?.replace(/^<|>$/g, "").trim();
        if (mid) serverMids.set(mid, msg.uid);
      }

      // Intersección: Message-IDs del backup que están en el servidor
      const toDelete: number[] = [];
      for (const mid of messageIds) {
        const uid = serverMids.get(mid);
        if (uid !== undefined) toDelete.push(uid);
      }

      const notFound = messageIds.size - toDelete.length;

      if (toDelete.length === 0) {
        console.log(`  ${accountName}/${imapFolder}: ninguno encontrado en servidor (${total} en backup)`);
        continue;
      }

      if (doDelete) {
        await client.messageDelete(toDelete, { uid: true });
        console.log(`  ✓ ${accountName}/${imapFolder}: ${toDelete.length} borrados${notFound > 0 ? ` (${notFound} no estaban en servidor)` : ""}`);
      } else {
        console.log(`  [dry-run] ${accountName}/${imapFolder}: ${toDelete.length} a borrar${notFound > 0 ? ` (${notFound} no estaban en servidor)` : ""}`);
      }
    } finally {
      lock.release();
    }
  }

  await client.logout().catch(() => undefined);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const accountDirs = await listSubdirs(resolvedBackupDir);
  const filtered = onlyAccount ? accountDirs.filter((a) => a === onlyAccount) : accountDirs;

  console.log(`\n=== Purge por Message-ID ===`);
  console.log(`Backup : ${resolvedBackupDir}`);
  console.log(`Modo   : ${doDelete ? "BORRAR (permanente)" : "DRY-RUN (solo contar)"}`);
  if (!doDelete) console.log(`\nAgrega --delete para borrar de verdad.\n`);
  console.log("");

  for (const accountName of filtered) {
    const imapUser = ACCOUNT_MAP[accountName] ?? `${accountName}@bioalergia.cl`;
    console.log(`[${accountName} → ${imapUser}]`);

    const backupFolders = await scanBackupAccount(join(resolvedBackupDir, accountName));
    if (backupFolders.length === 0) {
      console.log(`  sin carpetas con .eml`);
      continue;
    }

    await purgeAccount(accountName, backupFolders, imapUser);
  }

  console.log("\nListo.");
}

main().catch((err: unknown) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
