import { normalizeRut, validateRut } from "../../../lib/rut.ts";

import { LOWERCASE_NAME_STOPWORDS, RUT_REGEX } from "../constants.ts";
import {
  collapseRepeatedNameEdges,
  normalizeName,
  normalizeNameToken,
  stripNoiseFromText,
  stripNonNamePhrases,
} from "../normalization/names.ts";

/**
 * Extract name sequences from already-stripped text. Allows particles
 * ("de", "la", "del", …) between name tokens so compound surnames like
 * "León de la Sotta" or "Claudio de la Cuadra" are captured intact.
 */
export function extractNamesFromCleanedText(text: string): string[] {
  const PARTICLES = new Set(["de", "del", "la", "las", "los", "van", "von", "y", "e"]);
  const tokens = normalizeName(text)
    .split(" ")
    .filter(Boolean)
    .map((t) => normalizeNameToken(t))
    .filter(Boolean);

  const isParticle = (t: string) => PARTICLES.has(t);
  const isNameToken = (t: string) =>
    t.length >= 3 && !/\d/.test(t) && !LOWERCASE_NAME_STOPWORDS.has(t) && !isParticle(t);

  const results: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (!isNameToken(tokens[i])) {
      i++;
      continue;
    }

    const seq: string[] = [tokens[i]];
    let j = i + 1;

    while (j < tokens.length && seq.length < 6) {
      const t = tokens[j];
      if (isNameToken(t)) {
        seq.push(t);
        j++;
      } else if (isParticle(t)) {
        // Allow particles only when a name token eventually follows.
        let k = j + 1;
        while (k < tokens.length && isParticle(tokens[k])) k++;
        if (k < tokens.length && isNameToken(tokens[k])) {
          while (j <= k) seq.push(tokens[j++]);
        } else {
          break;
        }
      } else {
        break;
      }
    }

    // Names must not start or end with a particle.
    while (seq.length > 0 && isParticle(seq[seq.length - 1])) seq.pop();
    const collapsedSeq = collapseRepeatedNameEdges(seq);
    if (collapsedSeq.length >= 2) results.push(collapsedSeq.join(" "));
    i = j;
  }

  return [...new Set(results)].sort((a, b) => {
    const td = b.split(" ").length - a.split(" ").length;
    return td !== 0 ? td : b.length - a.length;
  });
}

// This is the highest-confidence source: secretaries typically write the
// patient name right before the RUT ("Nadia Yañez Rojas 12.345.678-9 ...").
export function extractRutAdjacentNames(text: string): string[] {
  const results: string[] = [];
  const globalRutRegex = new RegExp(RUT_REGEX.source, "g");
  let m: RegExpExecArray | null;

  while ((m = globalRutRegex.exec(text)) !== null) {
    const raw = text.slice(0, m.index).trim();
    // Strip clinical noise that appears between the name and the RUT:
    //   - Age annotations: "37 años,", "2 años;"
    //   - Parenthetical amounts/doses: "(50)", "(100)" — these are sometimes
    //     glued directly to the following word: "(50)luis" → must become "luis"
    //     so the backwards walk reaches the actual name token.
    const before = raw
      .replace(/\b\d{1,3}\s+a[ñn]os?[;:,]?\s*/gi, "")
      .replace(/\(\d+\)\s*/g, " ")
      .trim();
    // Take up to 5 raw tokens ending at the RUT and walk backwards, stopping
    // at the first token that looks like a stopword or non-name token.
    const rawTokens = before.split(/\s+/).slice(-5);
    // Short particles ("de", "la", "del", "las", "los") are valid in Chilean
    // compound surnames like "Claudio de la Cuadra". Allow them unless they're
    // the only token (i.e. don't start or end the name with a particle).
    const PARTICLES = new Set(["de", "del", "la", "las", "los", "van", "von", "y", "e"]);
    const nameTokens: string[] = [];
    for (const token of [...rawTokens].reverse()) {
      // Hyphen-prefixed tokens are field labels ("-Rut:", "-Edad", "-Número")
      // that secretaries write in structured notes — not name components.
      if (token.startsWith("-")) break;
      // Strip trailing digits so "martin9" is treated as "martin".
      const stripped = token.replace(/\d+$/, "");
      const normalized = normalizeName(stripped || token);
      if (!normalized || /\d/.test(normalized)) break;
      // A single whitespace-token can contain comma-joined words ("alamos,fonasa," →
      // "alamos fonasa"). Check each word individually so stopwords inside the
      // token are caught even when the full string isn't in the set.
      // IMPORTANT: Check stopwords BEFORE degluing — "clustoid" must break the walk,
      // not be stripped to "oid" by stripStopwordPrefix.
      const nWords0 = normalized.split(" ").filter(Boolean);
      if (nWords0.some((w) => LOWERCASE_NAME_STOPWORDS.has(w))) break;
      // Deglue stopword prefixes glued without a space ("llegodiego" → "diego").
      const n = normalizeNameToken(normalized);
      if (!n || /\d/.test(n)) break;
      // Check word lengths rather than total token length: "s/c" normalizes to
      // "s c" (3 chars) and would pass `n.length < 3`, but each word is 1 char.
      const nWords = n.split(" ").filter(Boolean);
      if (nWords.every((w) => w.length < 3) && !PARTICLES.has(n)) break;
      nameTokens.unshift(n);
    }
    // Drop leading/trailing particles — a name must start and end with a real token.
    while (nameTokens.length > 0 && PARTICLES.has(nameTokens[0])) nameTokens.shift();
    while (nameTokens.length > 0 && PARTICLES.has(nameTokens[nameTokens.length - 1]))
      nameTokens.pop();
    const collapsedTokens = collapseRepeatedNameEdges(nameTokens);
    if (collapsedTokens.length >= 2) results.push(collapsedTokens.join(" "));
  }

  return [...new Set(results)];
}

export function extractNamesFromText(text: string): string[] {
  if (!text) return [];
  const sanitizedText = stripNonNamePhrases(text);
  // High-confidence: names anchored immediately before a RUT in the raw text.
  const rutNames = extractRutAdjacentNames(sanitizedText);
  // Strip all noise then extract name sequences from what remains.
  const cleanedNames = extractNamesFromCleanedText(stripNoiseFromText(sanitizedText));
  return [...new Set([...rutNames, ...cleanedNames])];
}

export function isExplicitRutContext(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 32), index);
  return /rut(?:\s+del\s+paciente)?[\s:;-]*$/i.test(before);
}

export function isAcceptedRutCandidate(rawValue: string, index: number, text: string): boolean {
  const normalized = normalizeRut(rawValue);
  if (!normalized) return false;
  const body = Number(normalized.split("-")[0]);
  if (!(body >= 1_000_000 && body < 50_000_000)) return false;

  const hasFormatting = /[.-]/.test(rawValue);
  if (hasFormatting || isExplicitRutContext(text, index)) {
    return true;
  }

  const digits = rawValue.replace(/\D/g, "");
  if (digits.length >= 9 && digits.startsWith("9")) {
    return false;
  }

  return validateRut(rawValue);
}
