// Removes keys whose value is `undefined` from an object literal.
// Used at oRPC service-call boundaries when `exactOptionalPropertyTypes`
// is enabled on the caller but the callee uses `?: T` (no `| undefined`),
// e.g. ZenStack-generated `WhereInput` / `CreateInput`.
export function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) out[key] = val;
  }
  return out as T;
}
