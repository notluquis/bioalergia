// Decide which import pipeline an OneDrive xlsx belongs to based on
// its filename. Source of truth so the OneDrive sync, the reprocess
// job, and the manual reclassify endpoint all agree.
//
// Heuristics, in order:
//   1. Leading underscore + skin-test keyword     → SKIN_TEST
//      (e.g. `_PRICK TEST …`, `_MULTITEST 1, 3 …`).
//   2. Leading underscore + treatment keyword     → TREATMENT
//      (e.g. `_VACUNA SUBCUTANEA …`).
//   3. No leading underscore + ".xlsx" + plain    → MEDICAL_RECORD
//      patient-name pattern (`FABIO JORDAN DIAZ.xlsx`).
//   4. Anything else                              → UNKNOWN — operator
//      decides via PENDING_REVIEW UI.
//
// The classifier is intentionally permissive: false positives land in
// PENDING_REVIEW and are reclassifiable. Refs in
// docs/clinical-records.md (TBD).

export type XlsxClassification = "SKIN_TEST" | "MEDICAL_RECORD" | "TREATMENT" | "UNKNOWN";

const SKIN_KEYWORDS = /(prick|multitest|patch test|test cutan|test\s+cutaneo)/i;
const TREATMENT_KEYWORDS = /(vacuna|inyect|alxoid|clustoid|inmunoter)/i;

export function classifyXlsxFilename(filename: string): {
  kind: XlsxClassification;
  reason: string;
} {
  const trimmed = filename.trim();
  if (!trimmed.toLowerCase().endsWith(".xlsx")) {
    return { kind: "UNKNOWN", reason: "not an .xlsx file" };
  }

  if (trimmed.startsWith("_")) {
    if (SKIN_KEYWORDS.test(trimmed)) return { kind: "SKIN_TEST", reason: "_ + skin keyword" };
    if (TREATMENT_KEYWORDS.test(trimmed))
      return { kind: "TREATMENT", reason: "_ + treatment keyword" };
    return { kind: "UNKNOWN", reason: "_ prefix without recognized keyword" };
  }

  // No underscore, no skin/treatment keyword → ficha clínica candidate.
  if (SKIN_KEYWORDS.test(trimmed)) return { kind: "SKIN_TEST", reason: "skin keyword without _" };
  if (TREATMENT_KEYWORDS.test(trimmed))
    return { kind: "TREATMENT", reason: "treatment keyword without _" };

  return { kind: "MEDICAL_RECORD", reason: "plain patient-name pattern" };
}
