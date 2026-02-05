import type { ParsedQs } from "qs";

export type QueryValue = string | ParsedQs | (string | ParsedQs)[] | undefined;

export function toStringValues(value: QueryValue): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function ensureArray(value: QueryValue): string[] | undefined {
  const values = toStringValues(value);
  if (!values.length) {
    return undefined;
  }
  const result = values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
  return result.length ? result : undefined;
}

export function normalizeSearch(value: QueryValue): string | undefined {
  const [raw] = toStringValues(value);
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.slice(0, 200);
}

export function coercePositiveInteger(value: QueryValue): number | undefined {
  const [raw] = toStringValues(value);
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
}

export function coerceLimit(value: unknown, defaultLimit = 50, maxLimit = 2000): number {
  const num = Number(value ?? defaultLimit);
  if (!Number.isFinite(num) || num <= 0) {
    return defaultLimit;
  }
  return Math.min(Math.floor(num), maxLimit);
}

export function normalizeDate(value: QueryValue): string | undefined {
  const [raw] = toStringValues(value);
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  // Basic YYYY-MM-DD validation could go here, but for now just trim
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}
