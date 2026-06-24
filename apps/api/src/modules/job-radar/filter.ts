// Filtro de perfil: decide qué ofertas merecen alerta. Los valores
// (keywords/departamentos) los provee el caller (config desde DB). Si ambos
// están vacíos → matchea todo (notifica cualquier oferta nueva).

import type { RawJob } from "./types.ts";

export const DEFAULT_KEYWORDS = [
  "riesgo",
  "data",
  "datos",
  "product owner",
  "analista",
  "cumplimiento",
  "plaft",
];

export interface ProfileFilter {
  keywords: string[];
  departments: string[];
}

const KEYWORD_STOPWORDS = new Set([
  "para",
  "como",
  "con",
  "del",
  "las",
  "los",
  "una",
  "uno",
  "por",
  "que",
  "sus",
  "the",
  "and",
  "alto",
  "buscamos",
  "buscando",
  "checkr",
  "class",
  "clientes",
  "dentro",
  "equipo",
  "estamos",
  "esta",
  "este",
  "experiencia",
  "oportunidad",
  "senior",
  "junior",
  "href",
  "https",
  "name",
  "nbsp",
  "nuestro",
  "nuestros",
  "parte",
  "part",
  "personas",
  "quot",
  "span",
  "strong",
  "trabajar",
  "time",
  "what",
  "full",
  "plazo",
  "fijo",
  "reemplazo",
  "practica",
  "práctica",
  "chile",
  "santiago",
]);

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => norm(value).trim()).filter(Boolean))];
}

function textTokens(value: string): string[] {
  return norm(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !KEYWORD_STOPWORDS.has(token));
}

export function learnedKeywordsFromText(samples: string[], limit = 30): string[] {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const tokens = textTokens(sample);
    for (const token of new Set(tokens)) counts.set(token, (counts.get(token) ?? 0) + 1);
    for (let i = 0; i < tokens.length - 1; i++) {
      const left = tokens[i];
      const right = tokens[i + 1];
      if (!left || !right) continue;
      const phrase = `${left} ${right}`;
      counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

export function mergeProfileKeywords(configured: string[], learned: string[]): string[] {
  return unique([...configured, ...learned]);
}

export function matchesProfile(job: RawJob, filter: ProfileFilter): boolean {
  // Sin ninguna restricción → todo matchea.
  if (filter.keywords.length === 0 && filter.departments.length === 0) return true;

  const departments = unique(filter.departments);
  const keywords = unique(filter.keywords);
  const dept = norm(job.department ?? "");
  if (departments.length > 0 && departments.includes(dept)) return true;

  if (keywords.length > 0) {
    const haystack = norm(
      `${job.title} ${job.department ?? ""} ${job.location ?? ""} ${job.descriptionHtml ?? ""}`
    );
    if (keywords.some((kw) => haystack.includes(kw))) return true;
  }

  return false;
}
