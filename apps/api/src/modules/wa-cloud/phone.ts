// Normalize Chilean phone numbers to E.164 (+56...)
// Whatsapp gives `from` already without "+" usually, e.g. "56912345678"
const COUNTRY_CL = "56";

export function normalizeToE164(raw: string): string {
  if (!raw) return raw;
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith("9")) {
    digits = COUNTRY_CL + digits;
  }
  if (digits.length === 8) {
    // landline 8 digits, prepend 56 + 2 (assume Santiago) — caller should validate
    digits = COUNTRY_CL + "2" + digits;
  }
  return `+${digits}`;
}

export function stripPlus(e164: string): string {
  return e164.startsWith("+") ? e164.slice(1) : e164;
}
