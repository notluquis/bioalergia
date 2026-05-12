// IMAP fetcher: lee buzón de Lucas, busca emails de proveedores (boletas),
// extrae monto + fecha vencimiento + servicio, forwardea a Bioalergia API.
//
// Uso (manual o cron local):
//   pnpm --filter @finanzas/local-mail-agent run fetch:bills
//
// Auth: usa keychain (smtp_user / smtp_pass) ya configurado para envío.
// IMAP server: mail.spacemail.com:993 (default Spacemail).
//
// Status: STUB — connect + listar implementado, parsing por proveedor TODO.
// Lucas: cuando llegue una boleta real por email, copiamos el HTML/texto
// crudo y armamos parser específico por sender.

import { ImapFlow } from "imapflow";

import { readKeychainSecret } from "./keychain";

async function getCredential(account: string): Promise<null | string> {
  return readKeychainSecret("bioalergia-local-mail-agent", account);
}

// Senders conocidos → mapping a ExpenseService.name / UtilityProvider.
// Lucas extiende según boletas que reciba.
const KNOWN_SENDERS: Record<
  string,
  { provider: string; serviceHint: string }
> = {
  "boletas@cge.cl": { provider: "CGE", serviceHint: "Servicios básicos" },
  "boletas@essbio.cl": { provider: "ESSBIO", serviceHint: "Servicios básicos" },
  "boletas@telsur.cl": { provider: "TELSUR", serviceHint: "Telesur" },
  "facturacion@doctoralia.cl": {
    provider: "DOCTORALIA",
    serviceHint: "Doctoralia",
  },
  "facturas@movistar.cl": { provider: "MOVISTAR", serviceHint: "Movistar" },
  "info@medipass.cl": { provider: "MEDIPASS", serviceHint: "Medipass" },
  "notificaciones@previred.com": {
    provider: "PREVIRED",
    serviceHint: "Imposiciones",
  },
};

export interface ParsedBillEmail {
  amount: null | number;
  dueDate: null | string;
  from: string;
  provider: string;
  rawHtml: null | string;
  rawText: null | string;
  receivedAt: string;
  serviceHint: string;
  subject: string;
}

const AMOUNT_PATTERNS = [
  // $ 65.153  / $65.153 / CLP 65.153
  /\$\s?([\d.]+(?:,\d+)?)/i,
  /CLP\s?([\d.]+(?:,\d+)?)/i,
  /total[\s:]+([\d.]+)/i,
  /monto[\s:]+\$?\s?([\d.]+)/i,
];

const DUE_PATTERNS = [
  /vence(?:r)?[\s:]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  /vencimiento[\s:]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  /pagar antes de[\s:]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
];

function parseAmount(text: string): null | number {
  for (const p of AMOUNT_PATTERNS) {
    const m = text.match(p);
    if (m) {
      const raw = m[1].replace(/\./g, "").replace(",", ".");
      const n = Number(raw);
      if (!Number.isNaN(n) && n > 100) return n;
    }
  }
  return null;
}

function parseDueDate(text: string): null | string {
  for (const p of DUE_PATTERNS) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function fetchUnreadBillEmails(options: {
  imapHost?: string;
  imapPort?: number;
  imapSecure?: boolean;
  markSeen?: boolean;
} = {}): Promise<ParsedBillEmail[]> {
  const user = await getCredential("smtp_user");
  const pass = await getCredential("smtp_pass");

  if (!user || !pass) {
    throw new Error(
      "IMAP credentials missing from keychain (smtp_user, smtp_pass)"
    );
  }

  const client = new ImapFlow({
    auth: { pass, user },
    host: options.imapHost ?? "mail.spacemail.com",
    logger: false,
    port: options.imapPort ?? 993,
    secure: options.imapSecure ?? true,
  });

  const parsed: ParsedBillEmail[] = [];

  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Search unread from known senders (last 60 days)
      const since = new Date();
      since.setDate(since.getDate() - 60);

      const senderList = Object.keys(KNOWN_SENDERS);
      const searchResult = await client.search({ since, seen: false });
      const uids: number[] = Array.isArray(searchResult) ? searchResult : [];

      if (uids.length === 0) {
        return parsed;
      }

      for await (const msg of client.fetch(uids, {
        envelope: true,
        source: true,
      })) {
        const envelope = msg.envelope;
        const source = msg.source;
        if (!envelope || !source) continue;

        const from = envelope.from?.[0]?.address?.toLowerCase() ?? "";
        if (!senderList.includes(from)) continue;

        const meta = KNOWN_SENDERS[from];
        const rawText = source.toString("utf8");

        parsed.push({
          amount: parseAmount(rawText),
          dueDate: parseDueDate(rawText),
          from,
          provider: meta.provider,
          rawHtml: null,
          rawText: rawText.slice(0, 50000),
          receivedAt: (envelope.date ?? new Date()).toISOString(),
          serviceHint: meta.serviceHint,
          subject: envelope.subject ?? "",
        });

        if (options.markSeen) {
          await client.messageFlagsAdd(msg.uid, ["\\Seen"]);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return parsed;
}

/**
 * Forwardea boletas parseadas a Bioalergia API (endpoint a crear).
 * Por ahora solo retorna las parsed. Lucas decidirá si push automático
 * o muestra UI para confirmar antes de crear Expense.
 */
export async function forwardBillsToBioalergia(
  bills: ParsedBillEmail[],
  apiUrl: string,
  agentToken: string
): Promise<void> {
  for (const bill of bills) {
    try {
      await fetch(`${apiUrl}/api/orpc/email-bill-import/rpc/import`, {
        body: JSON.stringify(bill),
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Token": agentToken,
        },
        method: "POST",
      });
    } catch (err) {
      console.error(`[email-bill] forward failed for ${bill.from}:`, err);
    }
  }
}
