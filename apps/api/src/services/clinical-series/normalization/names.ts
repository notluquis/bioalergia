import {
  AGE_REGEX,
  LONG_NUMBER_REGEX,
  LOWERCASE_NAME_STOPWORDS,
  RUT_REGEX,
  SEPARATOR_REGEX,
  STANDALONE_NUMBER_REGEX,
  TIME_REGEX,
} from "../constants.ts";

export function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripNonNamePhrases(text: string): string {
  return text
    .replace(/\b[\p{L}]+-rut\b/giu, " ")
    .replace(
      /(^|[\n,;]\s*)(?:(?:envio\s+de|toca|ultima|licencia|aca|incluir\s+huevos|ovo\s+y\s+nativos|quiere\s+de\s+standard|(?:lec|lectura)\s+de(?:\s+de)?|contesto|quiso\s+realizar(?:\s+confirmado)?|confirm(?:ado|ada|o|a|s|ara|aq)?|(?:no\s+)?vino(?:\s+confirma(?:do|da|o|a|s|ra)?)?|llego(?:p)?(?:\s+confirma(?:do|da|o|a|s|ra)?)?|se\s+llev(?:a|o)\s+vacuna\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)|feb|mayo)(?:\s+(?:de|y))?\s+)/gi,
      "$1"
    )
    .replace(/\bno\s+asistir[aá]\s+por\s+temas\s+econ[oó]micos\b/gi, " ")
    .replace(/\best[aá]\s+de\s+viaje\s+llamar[aá]\s+para\s+reagendar\b/gi, " ")
    .replace(/\bdr\.?\s+suspendi[oó]\s+vacuna\s+[a-záéíóúñ]+\b/gi, " ")
    .replace(/\bpagamos\s+el\s+env[ií]o\s+nosotros\b/gi, " ")
    .replace(/\bsacar\s+el\s+refri\s+\d+\s*min\s+antes\b/gi, " ")
    .replace(
      /(^|[\n,;]\s*)(?:(?:prox|covid|(?:se\s+)?envi(?:a|ada|ado|ar))(?:\s+(?:de|y|vacuna|vacunas|dia|d[ií]a|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))*\s+)/gi,
      "$1"
    )
    .replace(
      /(^|[\n,;]\s*)(?:(?:manda\s+)?(?:la?s\s+)?fotos?(?:\s+(?:de\s+boleta|de\s+repetido|recordar\s+de|y\s+de|de))?\s+)/gi,
      "$1"
    )
    .replace(/\blas\s+y\s+de\s+/gi, " ")
    .replace(/\bprox(?:imo)?\s+mes\b/gi, " ")
    .replace(/\ba\s*-\s*(?:g|p)\b/gi, " ")
    .replace(
      /,\s*[^,;()]{3,80}\(\s*(?:pap[aá]|mam[aá]|tutor(?:a)?)\s*\)(?=(?:\s*,|\s*\(|$))/gi,
      " "
    )
    .replace(/\(\s*(?:pap[aá]|mam[aá]|tutor(?:a)?)\s+[^)]*\)/gi, " ")
    .replace(/,\s*(?:pap[aá]|mam[aá]|tutor(?:a)?)\s+[^,;()]{3,80}(?=(?:\s*,|\s*\(|$))/gi, " ")
    .replace(/\bs\s*\/\s*c[a-záéíóúñ]*/gi, " ")
    .replace(/\b\/?\s*esposa\s*:\s*\d{5,}\b/gi, " ")
    .replace(/\([^)]*\b(?:emite\s+boleta|gestiona\s+pago)\b[^)]*\)/gi, " ")
    .replace(/\balergia\s+(?:muy\s+)?(?:fuerte|severa|intensa)\s+a\s+[^.;\n]+/gi, " ")
    .replace(/\bdesea\s+iniciar\s+tratamiento(?:\s+de\s+inmunoterapia)?[^.;\n]*/gi, " ")
    .replace(/\bsan\s+carlos\b/gi, " ")
    .replace(/\bsan\s+pedro\s+de\s+la\s+paz\b/gi, " ")
    .replace(/\bde\s+la\s+paz\b/gi, " ")
    .replace(/\bsan\s+pedro\b/gi, " ")
    .replace(/\bcuranilahue\b/gi, " ")
    .replace(/\bhu[eé]pil\b/gi, " ")
    .replace(/\bmulchen\b/gi, " ")
    .replace(/\bcurico\b/gi, " ")
    .replace(/\barauco\b/gi, " ")
    .replace(/\branquil\b/gi, " ")
    .replace(/\bspp\b/gi, " ")
    .replace(/\bpuerto\s+varas\b/gi, " ")
    .replace(/\bcruz\s+blanca\b/gi, " ")
    .replace(/\byerbas\s+buenas\b/gi, " ")
    .replace(/\blinares\b/gi, " ")
    .replace(/\brespiratori[ao]s?\b/gi, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFlexibleStopwordPrefixRegex(stopword: string): RegExp {
  return new RegExp(`^${[...stopword].map((char) => `${escapeRegex(char)}+`).join("")}`);
}

const NON_DEGLUE_STOPWORDS = new Set(["cons"]);

/**
 * If a stopword of ≥4 chars is glued directly to the start of `token`
 * (e.g. "llegodiego" = "llego" + "diego"), returns the remainder after the
 * stopword so downstream checks can evaluate it on its own.
 * Uses the longest matching prefix to avoid partial matches.
 */
export function stripStopwordPrefix(token: string): string {
  let current = token;

  while (current.length > 0) {
    let bestMatchedPrefixLength = 0;
    let bestStopwordLength = 0;

    for (const sw of LOWERCASE_NAME_STOPWORDS) {
      if (NON_DEGLUE_STOPWORDS.has(sw)) continue;
      if (sw.length < 4) continue;

      const match = current.match(buildFlexibleStopwordPrefixRegex(sw));
      if (!match) continue;

      const matchedPrefixLength = match[0].length;
      const remainderLength = current.length - matchedPrefixLength;
      if (remainderLength !== 0 && remainderLength < 4) continue;

      if (
        sw.length > bestStopwordLength ||
        (sw.length === bestStopwordLength && matchedPrefixLength > bestMatchedPrefixLength)
      ) {
        bestMatchedPrefixLength = matchedPrefixLength;
        bestStopwordLength = sw.length;
      }
    }

    if (bestMatchedPrefixLength === 0) break;
    current = current.slice(bestMatchedPrefixLength);
  }

  return current;
}

export function normalizeNameToken(token: string): string {
  const stripped = stripStopwordPrefix(token)
    .replace(/^s\s+c\b\s*/i, "")
    .replace(/^-+|-+$/g, "");

  if (!stripped.includes("-")) {
    return stripped;
  }

  const parts = stripped
    .split("-")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !LOWERCASE_NAME_STOPWORDS.has(part));

  return parts.join(" ");
}

/**
 * Strip all non-name noise from raw event text so that name extraction
 * sees only name tokens. Order matters: RUTs must be stripped before
 * separators (dots in "12.345.678-9"), age before lone digits.
 */
export function stripNoiseFromText(text: string): string {
  return stripNonNamePhrases(text)
    .replace(TIME_REGEX, " ") // 15:00, 9:30
    .replace(new RegExp(RUT_REGEX.source, "g"), " ") // 12.345.678-9
    .replace(AGE_REGEX, " ") // "36 años"
    .replace(LONG_NUMBER_REGEX, " ") // phones, codes ≥5 digits
    .replace(STANDALONE_NUMBER_REGEX, " ") // remaining bare numbers
    .replace(SEPARATOR_REGEX, " ") // ;:,()[]{}
    .replace(/\s+/g, " ")
    .trim();
}

export function collapseRepeatedNameEdges(tokens: string[]): string[] {
  for (let size = Math.min(3, Math.floor(tokens.length / 2)); size >= 1; size -= 1) {
    const prefix = tokens.slice(0, size);
    const repeatedPrefix = tokens.slice(size, size * 2);
    if (
      prefix.length === repeatedPrefix.length &&
      prefix.every((token, index) => token === repeatedPrefix[index])
    ) {
      return [...prefix, ...tokens.slice(size * 2)];
    }
  }

  for (let size = Math.min(3, Math.floor(tokens.length / 2)); size >= 1; size -= 1) {
    const prefix = tokens.slice(0, size);
    const suffix = tokens.slice(tokens.length - size);
    if (prefix.every((token, index) => token === suffix[index])) {
      return tokens.slice(0, tokens.length - size);
    }
  }

  return tokens;
}

export function getSignificantNameTokens(name: string): string[] {
  return [
    ...new Set(
      normalizeName(name)
        .split(" ")
        .filter((t) => t.length >= 3 && !LOWERCASE_NAME_STOPWORDS.has(t))
    ),
  ];
}
