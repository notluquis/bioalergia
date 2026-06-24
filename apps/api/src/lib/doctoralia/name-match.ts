export function normalizePatientNameForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(dra?\.?|dr\.?|sra?\.?|sr\.?|srta\.?)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDoctoraliaMatchWindow(appointmentDate: Date): {
  windowStart: Date;
  windowEnd: Date;
} {
  const minute = Math.floor(appointmentDate.getTime() / 60_000);
  return {
    windowStart: new Date(minute * 60_000 - 60_000),
    windowEnd: new Date(minute * 60_000 + 60_000),
  };
}

export const DOCTORALIA_STATUS_CANCELLED_BY_PATIENT = 2;
export const DOCTORALIA_STATUS_CANCELLED_BY_DOCTOR = 3;
export const DOCTORALIA_CANCELLED_STATUSES: readonly [
  typeof DOCTORALIA_STATUS_CANCELLED_BY_PATIENT,
  typeof DOCTORALIA_STATUS_CANCELLED_BY_DOCTOR,
] = [DOCTORALIA_STATUS_CANCELLED_BY_PATIENT, DOCTORALIA_STATUS_CANCELLED_BY_DOCTOR] as const;
