export function compactORPCInput<T extends object>(input: T | undefined): Partial<T> | undefined {
  if (!input) {
    return undefined;
  }

  const entries = Object.entries(input).filter(([, value]) => value !== undefined);
  return entries.length > 0 ? (Object.fromEntries(entries) as Partial<T>) : undefined;
}
