/**
 * Person utility helpers for safe and consistent name handling
 */

export interface PersonNameData {
  names?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
}

/**
 * Get complete person name by combining names + father name + mother name
 * Safe: returns empty string if person is null/undefined
 */
export function getPersonFullName(person?: PersonNameData | null): string {
  if (!person) return "";
  const parts = [person.names, person.fatherName, person.motherName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "";
}

/**
 * Get initials for avatar placeholder (2 characters max)
 * Safe: returns "?" if names is null/undefined
 */
export function getPersonInitials(person?: PersonNameData | null): string {
  if (!person?.names) return "?";

  // Try to get first char of first name + first char of last name
  const firstInitial = person.names.charAt(0).toUpperCase();

  // Prefer father name as "last name" for initials
  if (person.fatherName) {
    const fatherInitial = person.fatherName.charAt(0).toUpperCase();
    return `${firstInitial}${fatherInitial}`;
  }

  // If no father name, use second char of first name
  const secondInitial = person.names.charAt(1)?.toUpperCase() || "";
  return secondInitial ? `${firstInitial}${secondInitial}` : firstInitial;
}

/**
 * Extract person from API response that wraps it
 * Handles both { person: {...} } and direct person object
 */
export function extractPersonFromResponse<T extends Record<string, unknown>>(
  response: T | null | undefined
): (T extends { person: infer P } ? P : T) | null {
  if (!response) return null;
  if ("person" in response && response.person !== undefined && response.person !== null) {
    return response.person as T extends { person: infer P } ? P : T;
  }
  return response as T extends { person: infer P } ? P : T;
}

/**
 * Safe person name formatter for display
 * Shows full name or components based on availability
 */
export function formatPersonDisplay(person?: PersonNameData | null): string {
  const fullName = getPersonFullName(person);
  return fullName || "No identificado";
}
