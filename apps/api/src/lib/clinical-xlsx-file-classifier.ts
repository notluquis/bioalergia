import { isSkinTestCandidateFilename } from "./skin-test-file-filter.ts";

export type ClinicalXlsxFileClassification = "CLINICAL_DOCUMENT" | "OTHER" | "SKIN_TEST";

export interface ClinicalXlsxFileClassificationResult {
  classification: ClinicalXlsxFileClassification;
  reason: string;
}

export function classifyClinicalXlsxFilename(
  filename: string
): ClinicalXlsxFileClassificationResult {
  if (isSkinTestCandidateFilename(filename)) {
    return { classification: "SKIN_TEST", reason: "skin-test filename keyword" };
  }

  const documentKind = classifyClinicalDocumentFilename(filename);
  if (documentKind !== "OTHER") {
    return {
      classification: "CLINICAL_DOCUMENT",
      reason: `clinical document filename: ${documentKind}`,
    };
  }

  if (looksLikePatientNamedWorkbook(filename)) {
    return { classification: "CLINICAL_DOCUMENT", reason: "patient-name-only filename" };
  }

  return { classification: "OTHER", reason: "no module classifier matched" };
}

function classifyClinicalDocumentFilename(filename: string): "CLINICAL_RECORD" | "OTHER" | "VISIT_SHEET" {
  const text = normalizeDocumentName(filename);
  if (
    /\b(?:consulta|consultas|control|controles|visita|visitas|evolucion|evoluciones)\b/.test(text)
  ) {
    return "VISIT_SHEET";
  }
  if (/\b(?:ficha|fichas|clinica|clinico|historia|antecedentes)\b/.test(text)) {
    return "CLINICAL_RECORD";
  }
  return "OTHER";
}

function looksLikePatientNamedWorkbook(filename: string): boolean {
  const text = normalizeDocumentName(filename)
    .replace(/\b(?:copia|copy|final|actualizado|actualizada|nuevo|nueva|xlsx)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text || /\d/.test(text)) return false;

  const blocked =
    /\b(?:agenda|alergenos?|aeroalergenos?|alimentarios?|base|calendario|cartola|contabilidad|control|controles|doctoralia|dte|empresa|empresas|facturas?|ficha|fichas|formato|informe|lista|listado|multitest|pagos?|panel|plantilla|presupuesto|prick|registro|reporte|test|vacunas?)\b/;
  if (blocked.test(text)) return false;

  const parts = text.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.length <= 5 && parts.every((part) => part.length >= 2);
}

function normalizeDocumentName(filename: string): string {
  return filename
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}
