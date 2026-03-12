export function compactORPCInput<T extends object | undefined>(
  input: T
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
