/**
 * Doctoralia email parser.
 * Extracts patient booking info from Doctoralia notification emails.
 *
 * Sample patient line:  "Lucas Villagrán (+56987162160 sapf1983@gmail.com)"
 * Sample date line:     "Martes, 31 de marzo de 2026 a las 6:15 p. m."
 */

export interface DoctoraliaBookingInfo {
  patientName: string;
  patientPhone: string | null;
  patientEmail: string | null;
  isFirstAppointment: boolean;
  appointmentDate: Date | null;
  appointmentService: string | null;
  appointmentDoctor: string | null;
  clinicAddress: string | null;
}

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

/**
 * Extract booking info from an email's plain-text body.
 * Falls back gracefully if fields are not found.
 */
export function parseDoctoraliaEmail(text: string): DoctoraliaBookingInfo | null {
  if (!text) {
    return null;
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // --- Patient name + phone + email ---
  // Pattern: "Name Surname (+56912345678 email@example.com)"
  // or just:  "Name Surname (+56912345678)"
  const patientLinePattern = /^(.+?)\s*\(\s*([^)]+)\s*\)\s*$/;
  let patientName: string | null = null;
  let patientPhone: string | null = null;
  let patientEmail: string | null = null;

  for (const line of lines) {
    const match = patientLinePattern.exec(line);
    if (match) {
      const candidate = match[1].trim();
      // Make sure it looks like a name (not a date or URL)
      if (candidate.length > 2 && !/\d{4}|http|@/.test(candidate)) {
        patientName = candidate;
        const inner = match[2].trim();
        // Extract phone from inner group
        const phoneMatch = /\+?\d[\d\s]{7,14}/.exec(inner);
        if (phoneMatch) {
          patientPhone = phoneMatch[0].replace(/\s/g, "");
        }
        // Extract email from inner group
        const emailMatch = /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/.exec(inner);
        if (emailMatch) {
          patientEmail = emailMatch[0];
        }
        break;
      }
    }
  }

  // Fallback: any line containing a Chilean phone number that also has a name
  if (!patientName) {
    for (const line of lines) {
      const phoneMatch = /(\+?56\s*9\d{8}|\+\d{10,14})/.exec(line);
      if (phoneMatch) {
        patientPhone = phoneMatch[0].replace(/\s/g, "");
        // Name is everything before the phone
        const namePart = line.slice(0, phoneMatch.index).trim().replace(/[(),]/g, "").trim();
        if (namePart.length > 2) {
          patientName = namePart;
        }
        break;
      }
    }
  }

  // --- First appointment ---
  const isFirstAppointment = lines.some((l) =>
    /primera\s+cita\s+de\s+este\s+paciente/i.test(l),
  );

  // --- Appointment date ---
  // Line after "Fecha y hora" label.
  // Format: "Martes, 31 de marzo de 2026 a las 6:15 p. m."
  // Unicode spaces (U+00A0, U+202F) between time and am/pm are already normalized
  // by htmlToText before this function is called.
  let appointmentDate: Date | null = null;
  const dateIdx = lines.findIndex((l) => /^fecha\s+y\s+hora$/i.test(l));
  const dateLine = dateIdx !== -1 ? (lines[dateIdx + 1] ?? null) : null;

  if (dateLine) {
    const datePattern =
      /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+a\s+las\s+(\d{1,2}):(\d{2})\s*(a\s*\.?\s*m\.?|p\s*\.?\s*m\.?)/i;
    const match = datePattern.exec(dateLine);
    if (match) {
      const day = parseInt(match[1], 10);
      const monthName = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const hours = parseInt(match[4], 10);
      const minutes = parseInt(match[5], 10);
      const ampm = match[6].replace(/[\s.]/g, "").toLowerCase();
      const month = MONTH_MAP[monthName];

      if (month !== undefined) {
        let h = hours;
        if (ampm === "pm" && h < 12) h += 12;
        if (ampm === "am" && h === 12) h = 0;
        appointmentDate = new Date(year, month, day, h, minutes);
      }
    }
  }

  // --- Service ---
  // Line after "Servicio" label
  let appointmentService: string | null = null;
  const serviceIdx = lines.findIndex((l) => /^servicio$/i.test(l));
  if (serviceIdx !== -1 && serviceIdx + 1 < lines.length) {
    appointmentService = lines[serviceIdx + 1];
  }

  // Fallback: line that contains duration "(40 min)"
  if (!appointmentService) {
    const servicePattern = /\((\d+)\s*min\)/i;
    for (const line of lines) {
      if (servicePattern.test(line)) {
        appointmentService = line.trim();
        break;
      }
    }
  }

  // --- Doctor ---
  // Line after "Profesional" label
  let appointmentDoctor: string | null = null;
  const profIdx = lines.findIndex((l) => /^profesional$/i.test(l));
  if (profIdx !== -1 && profIdx + 1 < lines.length) {
    appointmentDoctor = lines[profIdx + 1];
  }

  // --- Clinic address ---
  let clinicAddress: string | null = null;
  const dirIdx = lines.findIndex((l) => /^direcci[oó]n$/i.test(l));
  if (dirIdx !== -1 && dirIdx + 1 < lines.length) {
    clinicAddress = lines[dirIdx + 1];
  }

  if (!patientName) {
    return null;
  }

  return {
    appointmentDate,
    appointmentDoctor,
    appointmentService,
    clinicAddress,
    isFirstAppointment,
    patientEmail,
    patientName,
    patientPhone,
  };
}

/**
 * Try to extract plain text from an HTML email body.
 * Simple approach: strip tags and decode common HTML entities.
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
    // Normalize Unicode whitespace variants to regular space
    .replace(/[\u00A0\u202F\u2009\u200A\u2002\u2003]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}
