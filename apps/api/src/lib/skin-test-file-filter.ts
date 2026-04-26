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

function normalizeSkinTestFilename(filename: string): string {
  return filename
    .replace(/\.xlsx$/i, "")
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}
