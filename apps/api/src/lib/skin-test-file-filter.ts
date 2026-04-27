export function isSkinTestCandidateFilename(filename: string): boolean {
  const normalized = normalizeSkinTestFilename(filename);
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  const spaced = normalized.replace(/[^a-z0-9]+/g, " ").trim();

  return (
    compact.includes("multitest") ||
    compact.includes("pricktest") ||
    compact.includes("testcutaneo") ||
    compact.includes("testcutanea") ||
    /\btests?\s+cutane[oa]s?\b/.test(spaced)
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
    .replace(/\b(multitest|multi\s+test|prick\s*test|pricktest|tests?\s+cutane[oa]s?)\b/g, " ")
    .replace(
      /\b(panel|aeroalergenos?|alimentarios?|pediatrico|pediatrica|acaros?|aines|ovolacteos?|ovalacteos?|grupo\s+de\s+los\s+8)\b/g,
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
