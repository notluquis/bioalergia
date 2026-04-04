/**
 * Phone number normalization and JID conversion utilities.
 * JID = Jabber ID, the format Baileys uses for WhatsApp recipients.
 */

const S_WHATSAPP_NET = "@s.whatsapp.net";

/**
 * Normalize a Chilean phone number to E.164 format.
 * Accepts: +56912345678, 56912345678, 912345678, 09..., etc.
 */
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().]/g, "");

  if (/^\+\d{10,15}$/.test(cleaned)) {
    return cleaned;
  }

  if (/^56\d{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  if (/^9\d{8}$/.test(cleaned)) {
    return `+56${cleaned}`;
  }

  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

/**
 * Convert a phone number (any format) to a WhatsApp JID.
 * Example: "+56912345678" → "56912345678@s.whatsapp.net"
 */
export function phoneToJid(phone: string): string {
  const normalized = normalizePhone(phone);
  const digits = normalized.replace(/^\+/, "");
  return `${digits}${S_WHATSAPP_NET}`;
}

/**
 * Extract the E.164 phone number from a WhatsApp JID.
 * Example: "56912345678@s.whatsapp.net" → "+56912345678"
 */
export function jidToPhone(jid: string): string {
  const user = jid.split("@")[0];
  return `+${user}`;
}
