/**
 * Transform object keys from camelCase to snake_case recursively
 */
export function toSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = toSnakeCase((obj as Record<string, unknown>)[key]);
    }
    return result;
  }

  return obj;
}
