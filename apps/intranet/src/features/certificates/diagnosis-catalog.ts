// Diagnósticos de receta — CIE-11 (WHO ICD-11) vía ECT widget + fallback escrito.
//
// La búsqueda de códigos la sirve el Embedded Coding Tool de la OMS contra el
// cloud API (release español). Acá solo vive el tipo de dato persistido y el
// helper de formateo para el PDF / columna legacy `diagnosis`.

export type PrescriptionDiagnosis = {
  category?: string;
  // Código CIE-10 equivalente (crosswalk WHO, aproximado) — referencia para el
  // dr acostumbrado a CIE-10.
  cie10Code?: string;
  code?: string;
  custom?: boolean;
  id: string;
  label: string;
  release?: string;
  source: "CIE-11" | "CUSTOM";
  sourceLabel?: string;
  // Foundation URI estable del entity CIE-11 (id.who.int/icd/entity/...).
  uri?: string;
};

export function formatPrescriptionDiagnoses(diagnoses: PrescriptionDiagnosis[]): string {
  return diagnoses
    .map((diagnosis) =>
      diagnosis.code ? `${diagnosis.code} - ${diagnosis.label}` : diagnosis.label
    )
    .join("; ");
}
