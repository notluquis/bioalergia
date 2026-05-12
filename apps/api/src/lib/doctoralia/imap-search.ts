export function resolveDoctoraliaSenderSearchTerms(senderFilter: string): string[] {
  const normalized = senderFilter.trim().toLowerCase();
  const terms = new Set<string>();

  if (normalized) {
    terms.add(normalized);
  }

  if (normalized === "doctoralia" || normalized === "doctoralia.com") {
    terms.add("doctoralia.com");
    terms.add("doctoralia.cl");
    terms.add("doctoralia");
  } else if (normalized === "doctoralia.cl") {
    terms.add("doctoralia.cl");
    terms.add("doctoralia.com");
    terms.add("doctoralia");
  } else if (normalized.startsWith("doctoralia.")) {
    terms.add("doctoralia.com");
    terms.add("doctoralia.cl");
    terms.add("doctoralia");
  }

  return [...terms];
}
