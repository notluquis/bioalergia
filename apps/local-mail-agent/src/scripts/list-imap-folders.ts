/**
 * Lista las carpetas IMAP reales de una cuenta en Spacemail.
 * Uso: pnpm --filter @finanzas/local-mail-agent list-folders --account contacto@bioalergia.cl
 */

import { ImapFlow } from "imapflow";
import { readKeychainSecret } from "../keychain.ts";

const IMAP_HOST = process.env.LOCAL_AGENT_IMAP_HOST ?? "mail.spacemail.com";
const IMAP_PORT = Number.parseInt(process.env.LOCAL_AGENT_IMAP_PORT ?? "993", 10);
const IMAP_SECURE = process.env.LOCAL_AGENT_IMAP_SECURE !== "0";
const IMPORT_SERVICE = "bioalergia-mail-import";

const args = process.argv.slice(2);
const account = args.find((_, i) => args[i - 1] === "--account") ?? args[0];

if (!account) {
  console.error("Uso: tsx list-imap-folders.ts --account <email>");
  process.exit(1);
}

const client = new ImapFlow({
  host: IMAP_HOST,
  port: IMAP_PORT,
  secure: IMAP_SECURE,
  auth: {
    user: account,
    pass: await readKeychainSecret(IMPORT_SERVICE, account),
  },
  logger: false,
});

await client.connect();
const folders = await client.list();
await client.logout().catch(() => undefined);

console.log(`\nCarpetas IMAP de ${account}:\n`);
for (const f of folders.sort((a, b) => a.path.localeCompare(b.path))) {
  const flags = [
    f.specialUse ? `specialUse=${f.specialUse}` : null,
    f.flags.has("\\Noselect") ? "Noselect" : null,
  ]
    .filter(Boolean)
    .join(", ");
  console.log(`  ${f.path}${flags ? `  (${flags})` : ""}`);
}
