/**
 * Person utility helpers for safe and consistent name handling
 */

export interface PersonNameData {
  fatherName?: null | string;
  motherName?: null | string;
  names?: null | string;
}

const TITLE_CASE_PARTICLES = new Set([
  "de",
  "del",
  "la",
  "las",
  "los",
  "y",
  "da",
  "das",
  "do",
  "dos",
  "van",
  "von",
]);

// Normalize all-caps (or all-lowercase) names to Title Case while preserving
// Spanish particles. "MARIA DEL PILAR SALAS" → "Maria del Pilar Salas".
// Empty or falsy input returns the empty string so callers can chain safely.
export function toTitleCase(input: null | string | undefined): string {
  if (!input) return "";
  return input
    .toLocaleLowerCase("es-CL")
    .split(/(\s+|-)/)
    .map((token, index) => {
      if (!token || /^(\s+|-)$/.test(token)) return token;
      if (index > 0 && TITLE_CASE_PARTICLES.has(token)) return token;
      return token.charAt(0).toLocaleUpperCase("es-CL") + token.slice(1);
    })
    .join("");
}

/**
 * Extract person from API response that wraps it
 * Handles both { person: {...} } and direct person object
 */
export function extractPersonFromResponse<T extends Record<string, unknown>>(
  response: null | T | undefined
): null | (T extends { person: infer P } ? P : T) {
  if (!response) {
    return null;
  }
  if ("person" in response && response.person !== undefined && response.person !== null) {
    return response.person as T extends { person: infer P } ? P : T;
  }
  return response as T extends { person: infer P } ? P : T;
}

/**
 * Safe person name formatter for display
 * Shows full name or components based on availability
 */
export function formatPersonDisplay(person?: null | PersonNameData): string {
  const fullName = getPersonFullName(person);
  return fullName || "No identificado";
}

/**
 * Get complete person name by combining names + father name + mother name
 * Safe: returns empty string if person is null/undefined
 */
export function getPersonFullName(person?: null | PersonNameData): string {
  if (!person) {
    return "";
  }

  const names = person.names?.trim() ?? "";
  if (!names) {
    return "";
  }

  const fatherName = person.fatherName?.trim() ?? "";
  const motherName = person.motherName?.trim() ?? "";

  // Otherwise, build full name from all parts
  const parts = [names, fatherName, motherName].filter(Boolean);
  return parts.join(" ");
}

/**
 * Get initials for avatar placeholder (2 characters max)
 * Safe: returns "?" if names is null/undefined
 */
export function getPersonInitials(person?: null | PersonNameData): string {
  if (!person?.names) {
    return "?";
  }

  // Try to get first char of first name + first char of last name
  const firstInitial = person.names.charAt(0).toUpperCase();

  // Prefer father name as "last name" for initials
  if (person.fatherName) {
    const fatherInitial = person.fatherName.charAt(0).toUpperCase();
    return `${firstInitial}${fatherInitial}`;
  }

  // If no father name, use second char of first name. charAt always returns a
  // string ("" past the end), so no optional chaining / nullish fallback needed.
  const secondInitial = person.names.charAt(1).toUpperCase();
  return secondInitial ? `${firstInitial}${secondInitial}` : firstInitial;
}
