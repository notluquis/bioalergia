export function isSkinTestCandidateFilename(filename: string): boolean {
  const normalized = normalizeSkinTestFilename(filename);
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  const spaced = normalized.replace(/[^a-z0-9]+/g, " ").trim();

  if (isAdministrativeSkinTestWorkbookName(spaced)) {
    return false;
  }

  return (
    compact.includes("multitest") ||
    compact.includes("multistest") ||
    compact.includes("ultitest") ||
    compact.includes("pricktest") ||
    compact.includes("patchtest") ||
    compact.includes("testcutaneo") ||
    compact.includes("testcutanea") ||
    /\btests?\s+de\s+parche\b/.test(spaced) ||
    /\btests?\s+parche\b/.test(spaced) ||
    /\bteste\s+de\s+parche\b/.test(spaced) ||
    /\bpruebas?\s+de\s+parche\b/.test(spaced) ||
    /\btests?\s+cutane[oa]s?\b/.test(spaced) ||
    /\bprick\s+(?:aeroalergenos?|aeroalergeno|alimentari[oa]s?|medicamentos?|aines?)\b/.test(spaced) ||
    /\bprick\s+[a-zñ]+(?:\s+[a-zñ]+){1,5}\b/.test(spaced) ||
    /^[a-zñ]+(?:\s+[a-zñ]+){0,4}\s+prick\b/.test(spaced) ||
    /\btests?\s+(?:de\s+)?aeroalergenos?\b/.test(spaced) ||
    /\bpanel\s+(?:[0-9]+|completo)?\s*aeroalergenos?\b/.test(spaced) ||
    /\baeroalergenos?\s+(?:i|ii|iii|iv|v)\b/.test(spaced) ||
    /\bpanel\s+alimentari[oa]\b/.test(spaced) ||
    /\balimentos?\s+(?:i|ii|iii|iv|v)\b/.test(spaced) ||
    /\bparche\s+(?:[0-9]+\s+)?(?:alergenos?|alimentario|alimentarios|aines?)\b/.test(spaced) ||
    /^[a-zñ]+(?:\s+[a-zñ]+){1,5}\s+parche\b/.test(spaced) ||
    /\bparche\s+[a-zñ]+(?:\s+[a-zñ]+){1,5}$/.test(spaced) ||
    /\btests?\s+latex\b/.test(spaced) ||
    /^[a-zñ]+(?:\s+[a-zñ]+){1,5}\s+latex\b/.test(spaced) ||
    /\blatex\s+[a-zñ]+(?:\s+[a-zñ]+){1,5}$/.test(spaced) ||
    /\b(?:acaros?|aines?|ltp|profilina)\b/.test(spaced) ||
    /\bpanel\s+alimentario\s+insectario\b/.test(spaced)
  );
}

export function isImportableSkinTestFilename(filename: string): boolean {
  return isSkinTestCandidateFilename(filename) && !isSkinTestTemplateFilename(filename);
}

export function isSkinTestTemplateFilename(filename: string): boolean {
  if (!isSkinTestCandidateFilename(filename)) return false;

  const normalized = normalizeSkinTestFilename(filename);
  const meaningfulRemainder = normalized
    .replace(/^_+/, " ")
    .replace(/^copia\s+de\s+/, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\b(nuevo|nueva|actualizado|actualizada|ultimo|ultima|final|este\s+si)\b/g, " ")
    .replace(
      /\b(multitest|multi\s+test|multistest|ultitest|prick\s*test|pricktest|prick|patch\s*test|tests?\s+cutane[oa]s?|tests?\s+de\s+parche|tests?\s+parche|teste\s+de\s+parche|tests?\s+latex|pruebas?\s+de\s+parche)\b/g,
      " "
    )
    .replace(
      /\b(panel|aeroalergenos?|aeroalegenos?|alimentarios?|alimentari[oa]|alimentos?|pediatrico|pediatrica|adulto|aplv|huevo|hcs|completos?|acaros?|ac|aines|antiinflamatorio|antinflamatorio|antibioticos?|medicamentos?|alergenos?|parche|latex|ltp|profilina|insectarios?|mariscos|pescado|producto\s+del\s+mar|ovolacteos?|ovalacteos?|ovalcateos?|grupo\s+(?:de\s+)?(?:los\s+)?8|g8|gr8|ov|p9)\b/g,
      " "
    )
    .replace(
      /\b(formato|formulario|plantilla|solicitud|inventario|invententario|costos?|pendiente|resultados?)\b/g,
      " "
    )
    .replace(/\b(?:achs|edad|multiaplicador(?:es)?)\b/g, " ")
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x|y|e|j|lj|p|m|[0-9]+)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return meaningfulRemainder.length === 0;
}

function normalizeSkinTestFilename(filename: string): string {
  return filename
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

function isAdministrativeSkinTestWorkbookName(spaced: string): boolean {
  if (/\b(?:costos?|cotizacion|inventario|invententario|recepcion|solicitud)\b/.test(spaced)) {
    return true;
  }

  return (
    /^stock\b/.test(spaced) ||
    /\bstock\s+(?:de\s+)?(?:alergenos?|vacunas?)\b/.test(spaced) ||
    /\b(?:alergenos?|vacunas?)\s+stock\b/.test(spaced) ||
    /^total\b/.test(spaced) ||
    /\btotal\s+(?:de\s+)?(?:alergenos?|vacunas?)\b/.test(spaced)
  );
}
