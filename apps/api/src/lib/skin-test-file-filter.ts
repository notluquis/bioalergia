export function isSkinTestCandidateFilename(filename: string): boolean {
  const normalized = normalizeSkinTestFilename(filename);
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  const spaced = normalized.replace(/[^a-z0-9]+/g, " ").trim();

  return (
    compact.includes("multitest") ||
    compact.includes("multistest") ||
    compact.includes("ultitest") ||
    compact.includes("pricktest") ||
    compact.includes("patchtest") ||
    compact.includes("testcutaneo") ||
    compact.includes("testcutanea") ||
    /\btests?\s+de\s+parche\b/.test(spaced) ||
    /\bpruebas?\s+de\s+parche\b/.test(spaced) ||
    /\btests?\s+cutane[oa]s?\b/.test(spaced) ||
    /\bprick\s+(?:aeroalergenos?|aeroalergeno|alimentari[oa]s?|medicamentos?|aines?)\b/.test(spaced) ||
    /\btests?\s+(?:de\s+)?aeroalergenos?\b/.test(spaced) ||
    /\bpanel\s+(?:[0-9]+|completo)?\s*aeroalergenos?\b/.test(spaced) ||
    /\baeroalergenos?\s+(?:i|ii|iii|iv|v)\b/.test(spaced) ||
    /\bpanel\s+alimentari[oa]\b/.test(spaced) ||
    /\balimentos?\s+(?:i|ii|iii|iv|v)\b/.test(spaced) ||
    /\bparche\s+(?:[0-9]+\s+)?(?:alergenos?|alimentario|alimentarios|aines?)\b/.test(spaced) ||
    /\btests?\s+latex\b/.test(spaced) ||
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
    .replace(/\b(nuevo|nueva|actualizado|actualizada|ultimo|ultima|final|este\s+si)\b/g, " ")
    .replace(
      /\b(multitest|multi\s+test|multistest|ultitest|prick\s*test|pricktest|patch\s*test|tests?\s+cutane[oa]s?|tests?\s+de\s+parche|pruebas?\s+de\s+parche)\b/g,
      " "
    )
    .replace(
      /\b(panel|aeroalergenos?|alimentarios?|alimentari[oa]|alimentos?|pediatrico|pediatrica|adulto|aplv|huevo|hcs|completo|acaros?|aines|antibioticos?|medicamentos?|alergenos?|parche|latex|ltp|profilina|insectario|ovolacteos?|ovalacteos?|grupo\s+de\s+los\s+8)\b/g,
      " "
    )
    .replace(
      /\b(formato|plantilla|solicitud|inventario|invententario|costos?|resultados?)\b/g,
      " "
    )
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x|y|e|[0-9]+)\b/g, " ")
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
