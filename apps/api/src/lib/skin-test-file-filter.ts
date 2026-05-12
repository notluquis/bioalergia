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
    /\btests?\s+de\s+parches?\b/.test(spaced) ||
    /\btests?\s+parches?\b/.test(spaced) ||
    /\bteste\s+de\s+parches?\b/.test(spaced) ||
    /\bpruebas?\s+de\s+parches?\b/.test(spaced) ||
    /\btests?\s+cutane[oa]s?\b/.test(spaced) ||
    /\bprick\s+(?:aeroalergenos?|aeroalergeno|alimentari[oa]s?|medicamentos?|aines?)\b/.test(
      spaced
    ) ||
    /\bprick\s+[a-zñ]+(?:\s+[a-zñ]+){1,5}\b/.test(spaced) ||
    /^[a-zñ]+(?:\s+[a-zñ]+){0,4}\s+prick\b/.test(spaced) ||
    /\btests?\s+(?:de\s+)?aeroalergenos?\b/.test(spaced) ||
    compact.includes("panelaeroalergenos") ||
    compact.includes("testdeparche") ||
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
    (/\b(?:acaros?|aines?|ltp|profilina|mariscos|pescado)\b/.test(spaced) &&
      !looksLikePatientAllergenFilename(spaced)) ||
    /\bgrupo\s+(?:de\s+)?(?:los\s+)?8\b/.test(spaced) ||
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
      /\b(multitest|multi\s+test|multistest|ultitest|prick\s*test|pricktest|prick|patch\s*test|tests?\s+cutane[oa]s?|tests?\s+de\s+parches?|tests?\s+parches?|teste\s+de\s+parches?|tests?\s+latex|pruebas?\s+de\s+parches?)\b/g,
      " "
    )
    .replace(
      /\b(panel|panelaeroalergenos|aeroalergenos?|aeroalegenos?|alimentarios?|alimentari[oa]|alimentos?|pediatrico|pediatrica|adulto|aplv|huevo|hcs|completos?|acaros?|ac|aines|antiinflamatorio|antinflamatorio|antibioticos?|medicamentos?|alergenos?|parches?|latex|ltp|profilina|insectarios?|mariscos|pescado|producto\s+del\s+mar|ovolacteos?|ovalacteos?|ovalcateos?|grupo\s+(?:de\s+)?(?:los\s+)?8|g8|gr8|ov|p9|bateria|corta|estandar|europeo|haptenos?|standard)\b/g,
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

function looksLikePatientAllergenFilename(spaced: string): boolean {
  const parts = spaced.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 6) return false;

  const allergenPattern = /^(?:acaros?|aines?|ltp|profilina|mariscos|pescado)$/;

  // Find the rightmost allergen keyword; allow a short medical suffix after it (e.g. "ita")
  let allergenIdx = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (allergenPattern.test(parts[i])) {
      allergenIdx = i;
      break;
    }
  }
  if (allergenIdx === -1) return false;

  // Tokens after the allergen must be short (<=4 chars) known medical suffixes
  const suffix = parts.slice(allergenIdx + 1);
  if (suffix.some((w) => w.length > 4 || !/^[a-zñ]+$/.test(w))) return false;

  // Tokens before allergen must be alpha-only name words, no skin-test qualifiers
  const nameWords = parts.slice(0, allergenIdx);
  if (nameWords.length === 0) return false;

  const joined = nameWords.join(" ");
  const hasSkinTestQualifier =
    /\b(?:tests?|prick|parches?|multi|panel|aeroalergenos?|alimentarios?|grupo)\b/.test(joined);
  if (hasSkinTestQualifier) return false;

  // Medical / clinical condition stems that frequently appear in skin
  // test filenames alongside the patient name (e.g. "MARTIN TORO RINITIA
  // ACAROS"). When any name token matches one of these, the filename is
  // a skin-test candidate, not a bare patient + allergen pair.
  const conditionStems =
    /\b(?:rinit\w+|asma\w*|dermat\w+|urtic\w+|sinusit\w+|conjuntiv\w+|alerg\w+|atopi\w+)\b/;
  if (conditionStems.test(joined)) return false;

  return nameWords.every((w) => /^[a-zñ]+$/.test(w) && w.length >= 2);
}

function normalizeSkinTestFilename(filename: string): string {
  return filename
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

function isAdministrativeSkinTestWorkbookName(spaced: string): boolean {
  if (
    /\b(?:costos?|cotizacion|inventario|invententario|recepcion|solicitud|lista)\b/.test(spaced)
  ) {
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
