/**
 * Type-safe error handling utilities for TanStack Form
 *
 * TanStack Form's error arrays can contain union types (string | object),
 * but .join() converts objects to "[object Object]". These utilities safely
 * stringify and format errors without losing information.
 */

/**
 * Convert a single error (which may be string or object) to a readable string.
 * Prioritizes explicit message properties over toString().
 */
export function stringifyError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    // Check for common message property names
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
    if ("detail" in error && typeof error.detail === "string") {
      return error.detail;
    }
  }
  // Fallback: use String() which will call toString() safely
  return String(error) || "Error desconocido";
}

/**
 * Convert error array to joined string, skipping undefined/empty values.
 * Safe for use in template literals and HTML.
 *
 * @example
 * field.state.meta.errors.length > 0 && (
 *   <FieldError>{formatErrors(field.state.meta.errors)}</FieldError>
 * )
 */
export function formatErrors(errors: unknown[]): string {
  if (!Array.isArray(errors)) return "";
  return errors
    .filter((e) => e !== undefined && e !== null && e !== "")
    .map(stringifyError)
    .join(", ");
}

/**
 * Check if error array has any actual errors (filters out empty/null).
 * Use this instead of checking .length directly when errors might contain invalid values.
 */
export function hasErrors(errors: unknown[] | undefined | null): boolean {
  if (!Array.isArray(errors)) return false;
  return errors.some((e) => e !== undefined && e !== null && e !== "");
}
