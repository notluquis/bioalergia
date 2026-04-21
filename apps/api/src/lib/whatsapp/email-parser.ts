/**
 * Doctoralia email parser.
 * Handles two email types sent by Doctoralia:
 *
 *  BOOKING      — "Tiene un nuevo paciente que ha reservado una cita"
 *  MODIFICATION — "X ha modificado la cita"
 *
 * Template variants:
 *  - New (2026+): charset=utf-8, sender @doctoralia.cl, 12h time with p. m.
 *  - Old (2025):  charset=iso-8859-1, sender @doctoralia.com, 24h time or range
 */

import { buildChileDate } from "../time";
import { normalizePhone } from "./jid";

export type DoctoraliaEmailEventType = "BOOKING" | "MODIFICATION" | "CANCELLATION";

export interface DoctoraliaBookingInfo {
  eventType: DoctoraliaEmailEventType;
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  /** New appointment date (or the single date for BOOKING) */
  appointmentDate: Date | null;
  /** Original date being replaced — only set for MODIFICATION */
  previousAppointmentDate: Date | null;
  appointmentService: string | null;
  appointmentDoctor: string | null;
  clinicAddress: string | null;
}

function cleanExtractedText(value: null | string | undefined): null | string {
  if (!value) return null;

  const cleaned = value
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/=\s*$/g, "")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

function decodeQuotedPrintableBytes(input: string): Uint8Array {
  const normalized = input.replace(/=(\r?\n)/g, "");
  const bytes: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];
    const hex = normalized.slice(i + 1, i + 3);

    if (current === "=" && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
      continue;
    }

    bytes.push(normalized.charCodeAt(i) & 0xff);
  }

  return Uint8Array.from(bytes);
}

function decodeText(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function looksQuotedPrintable(text: string): boolean {
  return /=\r?\n|=[0-9A-F]{2}/i.test(text);
}

export function decodeEmailBody({
  bodyBuffer,
  charset,
  encoding,
}: {
  bodyBuffer: Uint8Array | null | undefined;
  charset?: null | string;
  encoding?: null | string;
}): string {
  if (!bodyBuffer) return "";

  const normalizedCharset = charset?.trim().toLowerCase() || "utf-8";
  const normalizedEncoding = encoding?.trim().toLowerCase() || null;

  if (normalizedEncoding === "quoted-printable") {
    const qpSource = new TextDecoder("utf-8").decode(bodyBuffer);
    return decodeText(decodeQuotedPrintableBytes(qpSource), normalizedCharset);
  }

  const decoded = decodeText(bodyBuffer, normalizedCharset);
  if (looksQuotedPrintable(decoded)) {
    return decodeText(decodeQuotedPrintableBytes(decoded), normalizedCharset);
  }

  return decoded;
}

const DOCTORALIA_SIGNATURE_PATTERNS = [
  /doctoralia\.(cl|com|es|mx|ar|co|pe)/i,
  /tiene\s+un\s+nuevo\s+paciente\s+que\s+ha\s+reservado\s+una\s+cita/i,
  /ha\s+modificado\s+la\s+cita/i,
  /cancel\S*\s+(la|su)\s+cita/i,
  /^fecha\s+y\s+hora$/im,
  /^servicio$/im,
  /^profesional$/im,
  /^direcci[oó]n$/im,
];

const DOCTORALIA_SUBJECT_PATTERNS = [
  /^nueva cita:\s+.+\s+ha reservado desde doctoralia$/i,
  /^.+\s+modific[oó]\s+su cita/i,
  /^❌\s*.+\s+cancel[oó]\s+su cita/i,
  /^invitaci[oó]n para acceder a la agenda de doctoralia$/i,
];

const MONTH_MAP: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single-line date string in these formats:
 *   "31 de marzo de 2026 a las 6:15 p. m."   (12h with am/pm)
 *   "6 de mayo de 2025 a las 13:15"           (24h, no am/pm)
 *   "20 de mayo de 2025 a las 11:00-11:40"    (range — only start is used)
 */
function parseDateLine(line: string): Date | null {
  const pattern =
    /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+a\s+las\s+(\d{1,2}):(\d{2})(?:-\d{1,2}:\d{2})?(?:\s*(a\s*\.?\s*m\.?|p\s*\.?\s*m\.?))?/i;
  const match = pattern.exec(line);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const monthName = match[2].toLowerCase();
  const year = parseInt(match[3], 10);
  const hours = parseInt(match[4], 10);
  const minutes = parseInt(match[5], 10);
  const ampm = match[6]?.replace(/[\s.]/g, "").toLowerCase() ?? null;
  const month = MONTH_MAP[monthName];
  if (month === undefined) return null;

  let h = hours;
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return buildChileDate(year, month, day, h, minutes);
}

/**
 * Look for a date across one or two consecutive lines.
 * Handles both single-line ("Martes, 31 de marzo de 2026 a las 6:15 p. m.")
 * and two-line ("Martes, 20 de mayo de 2025\na las 11:00-11:40") formats.
 * Returns [date, nextLineIndex] where nextLineIndex is the line after the date.
 */
function findDateAt(lines: string[], startIdx: number): [Date | null, number] {
  const line = lines[startIdx];
  if (!line) return [null, startIdx + 1];

  // Single-line: contains both date and time
  const d = parseDateLine(line);
  if (d) return [d, startIdx + 1];

  // Two-line: date on this line, time on next
  // Date-only pattern: "Martes, 20 de mayo de 2025" (no "a las")
  if (/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/.test(line)) {
    const nextLine = lines[startIdx + 1] ?? "";
    if (/^a\s+las\s+/i.test(nextLine)) {
      const combined = `${line} ${nextLine}`;
      const d2 = parseDateLine(combined);
      if (d2) return [d2, startIdx + 2];
    }
  }

  return [null, startIdx + 1];
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseDoctoraliaEmail(text: string): DoctoraliaBookingInfo | null {
  if (!text) return null;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // --- Email type ---
  const isModification = lines.some((l) => /ha modificado la cita/i.test(l));
  const isCancellation =
    !isModification && lines.some((l) => /cancel\S*\s+(la|su)\s+cita/i.test(l));
  const eventType: DoctoraliaEmailEventType = isModification
    ? "MODIFICATION"
    : isCancellation
      ? "CANCELLATION"
      : "BOOKING";

  // --- Patient ---
  const patientLinePattern = /^(.+?)\s*\(\s*([^)]+)\s*\)\s*$/;
  let patientName: string | null = null;
  let patientPhone: string | null = null;
  let patientEmail: string | null = null;

  for (const line of lines) {
    const match = patientLinePattern.exec(line);
    if (match) {
      const candidate = match[1].trim();
      const inner = match[2].trim();
      if (candidate.length > 2 && !/\d{4}|http|@/.test(candidate)) {
        if (/\b\d+\s*min\b/i.test(inner)) {
          continue;
        }

        patientName = cleanExtractedText(candidate);
        const phoneMatch = /\+?\d[\d\s]{7,14}/.exec(inner);
        if (phoneMatch) patientPhone = normalizePhone(phoneMatch[0]);
        const emailMatch = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/.exec(inner);
        if (emailMatch) patientEmail = emailMatch[0];
        break;
      }
    }
  }

  // Fallback: Chilean phone number on a line
  if (!patientName) {
    for (const line of lines) {
      const phoneMatch = /(\+?56\s*9\d{8}|\+\d{10,14})/.exec(line);
      if (phoneMatch) {
        patientPhone = normalizePhone(phoneMatch[0]);
        const namePart = line.slice(0, phoneMatch.index).trim().replace(/[(),]/g, "").trim();
        if (namePart.length > 2) patientName = cleanExtractedText(namePart);
        break;
      }
    }
  }

  if (!patientPhone) {
    for (const line of lines) {
      const phoneMatch = /(\+?56\s*9\d{8}|\+?\d[\d\s()-]{8,})/.exec(line);
      if (phoneMatch) {
        patientPhone = normalizePhone(phoneMatch[0]);
        break;
      }
    }
  }

  if (!patientEmail) {
    for (const line of lines) {
      const emailMatch = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/.exec(line);
      if (emailMatch) {
        patientEmail = emailMatch[0];
        break;
      }
    }
  }

  if (!patientName) return null;

  // --- Dates ---
  let appointmentDate: Date | null = null;
  let previousAppointmentDate: Date | null = null;

  if (!isModification && !isCancellation) {
    // BOOKING: look for "Fecha y hora" label, then take the next line(s)
    const dateIdx = lines.findIndex((l) => /^fecha\s+y\s+hora$/i.test(l));
    if (dateIdx !== -1) {
      [appointmentDate] = findDateAt(lines, dateIdx + 1);
    }
  } else if (isModification) {
    // MODIFICATION: two date blocks appear in sequence — new date first, old date second.
    const datePairs: Date[] = [];
    let i = 0;
    while (i < lines.length && datePairs.length < 2) {
      const line = lines[i];
      if (line && /\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/.test(line)) {
        const [d, nextI] = findDateAt(lines, i);
        if (d) {
          datePairs.push(d);
          i = nextI;
          continue;
        }
      }
      i++;
    }
    appointmentDate = datePairs[0] ?? null;
    previousAppointmentDate = datePairs[1] ?? null;
  } else {
    // CANCELLATION: single date (the cancelled appointment)
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line && /\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/.test(line)) {
        const [d, nextI] = findDateAt(lines, i);
        if (d) {
          appointmentDate = d;
          i = nextI;
          break;
        }
      }
      i++;
    }
  }

  // --- Service ---
  let appointmentService: string | null = null;

  if (!isModification && !isCancellation) {
    // BOOKING: line after "Servicio" label
    const serviceIdx = lines.findIndex((l) => /^servicio$/i.test(l));
    if (serviceIdx !== -1) appointmentService = cleanExtractedText(lines[serviceIdx + 1] ?? null);
  }

  // Fallback for both types: line containing "(X min)"
  if (!appointmentService) {
    const servicePattern = /\(\d+\s*min\)/i;
    for (const line of lines) {
      if (servicePattern.test(line)) {
        appointmentService = cleanExtractedText(line.trim());
        break;
      }
    }
  }

  // --- Doctor ---
  let appointmentDoctor: string | null = null;

  const profIdx = lines.findIndex((l) => /^profesional$/i.test(l));
  if (profIdx !== -1) {
    appointmentDoctor = cleanExtractedText(lines[profIdx + 1] ?? null);
  } else if (isModification || isCancellation) {
    // MODIFICATION / CANCELLATION: doctor appears directly after service (no label)
    const serviceLineIdx = lines.findIndex((l) => /\(\d+\s*min\)/i.test(l));
    if (serviceLineIdx !== -1) {
      const candidate = cleanExtractedText(lines[serviceLineIdx + 1]);
      // Basic name heuristic: at least two words, no digits, no URLs
      if (candidate && /^[A-ZÁÉÍÓÚÜÑa-záéíóúüñ]/.test(candidate) && !/\d|http/.test(candidate)) {
        appointmentDoctor = candidate;
      }
    }
  }

  // --- Clinic address ---
  let clinicAddress: string | null = null;

  const dirIdx = lines.findIndex((l) => /^direcci[oó]n$/i.test(l));
  if (dirIdx !== -1) {
    clinicAddress = cleanExtractedText(lines[dirIdx + 1] ?? null);
  } else if (isModification || isCancellation) {
    // MODIFICATION / CANCELLATION: clinic appears after doctor (two lines after service)
    const serviceLineIdx = lines.findIndex((l) => /\(\d+\s*min\)/i.test(l));
    if (serviceLineIdx !== -1 && appointmentDoctor) {
      clinicAddress = cleanExtractedText(lines[serviceLineIdx + 2] ?? null);
    }
  }

  return {
    appointmentDate,
    appointmentDoctor: cleanExtractedText(appointmentDoctor),
    appointmentService: cleanExtractedText(appointmentService),
    clinicAddress: cleanExtractedText(clinicAddress),
    eventType,
    patientEmail,
    patientName: cleanExtractedText(patientName) ?? patientName,
    patientPhone,
    previousAppointmentDate,
  };
}

function normalizeDoctoraliaMatchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function isLikelyDoctoraliaEmail(
  text: string,
  options?: { subject?: null | string },
): boolean {
  const normalizedSubject = options?.subject
    ? normalizeDoctoraliaMatchText(options.subject)
    : null;
  if (normalizedSubject) {
    for (const pattern of DOCTORALIA_SUBJECT_PATTERNS) {
      if (pattern.test(normalizedSubject)) return true;
    }
  }

  if (!text) return false;

  const normalizedText = normalizeDoctoraliaMatchText(text);

  if (
    /^nueva cita:/im.test(normalizedText) ||
    /ha reservado desde doctoralia/im.test(normalizedText) ||
    /modifico su cita/im.test(normalizedText) ||
    /cancel\S*\s+(la|su)\s+cita/im.test(normalizedText)
  ) {
    return true;
  }

  let matched = 0;
  for (const pattern of DOCTORALIA_SIGNATURE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      matched++;
      if (matched >= 2) return true;
    }
  }

  return false;
}

/**
 * Try to extract plain text from an HTML email body.
 * Also normalizes Unicode whitespace (NBSP, narrow NBSP) to regular spaces.
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(tr|p|div|li|h[1-6])[^>]*>/gi, "\n")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
    // Normalize Unicode whitespace variants to regular space
    .replace(/[\u00A0\u202F\u2009\u200A\u2002\u2003]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}
