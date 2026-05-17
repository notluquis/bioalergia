import { FORMATTED_RUT_REGEX } from "../constants.ts";

const PHONE_CANDIDATE_REGEX = /(?:\+?56[ \t-]*)?(?:9[ \t-]*)?(?:\d[ \t-]*){8,9}/g;

export function normalizePhoneSearch(value: null | string | undefined): null | string {
  if (!value) return null;
  const digits = value.replace(/\D+/g, "");
  return digits.length > 0 ? digits : null;
}

export function normalizeExtractedPhoneDigits(digits: string): null | string {
  if (!digits) return null;
  if (digits.startsWith("00")) return normalizeExtractedPhoneDigits(digits.slice(2));
  if (digits.startsWith("0")) return normalizeExtractedPhoneDigits(digits.slice(1));
  if (digits.startsWith("56") && digits.length === 11 && digits[2] === "9") return `+${digits}`;
  if (digits.length === 9 && digits.startsWith("9")) return `+56${digits}`;
  if (digits.length === 8) return `+569${digits}`;
  return null;
}

export function normalizeExtractedPhone(value: null | string | undefined): null | string {
  const digits = normalizePhoneSearch(value);
  return digits ? normalizeExtractedPhoneDigits(digits) : null;
}

export function extractPhoneCandidates(text: null | string | undefined): string[] {
  if (!text) return [];
  // Strip only clearly formatted RUTs here. Bare 9-digit phones like
  // "963080233" must survive this cleanup step.
  const withoutRuts = text.replace(new RegExp(FORMATTED_RUT_REGEX.source, "g"), " ");
  const matches = withoutRuts.match(PHONE_CANDIDATE_REGEX) ?? [];
  return [
    ...new Set(
      matches.map((match) => normalizeExtractedPhone(match)).filter((v): v is string => Boolean(v))
    ),
  ];
}

export function normalizeStoredPhoneArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    const normalized = normalizeExtractedPhone(typeof item === "string" ? item : null);
    if (!normalized) continue;
    seen.add(normalized);
  }
  return [...seen];
}
