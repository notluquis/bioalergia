/**
 * Throws if the condition is falsy. Acts as a runtime + type narrowing
 * guard — TypeScript treats the call as an `asserts` so code after the
 * check sees the value as non-nullable / narrowed.
 *
 * Use this instead of `x!` (non-null assertion) or `x as Foo` (cast)
 * whenever you "know" something is true at runtime but TS can't prove it.
 * The `!` operator silently turns nullable access into a runtime crash;
 * `invariant()` surfaces the violation with a useful message and a stack
 * trace pointing at the precise line.
 *
 * @example
 *   const user = users.find((u) => u.id === id);
 *   invariant(user, `user ${id} not found`);
 *   // user is now User, not User | undefined
 *
 * @example  enabled-gate inside TanStack Query queryFn
 *   useQuery({
 *     queryKey: ["x", id],
 *     enabled: id != null,
 *     queryFn: () => {
 *       invariant(id != null, "queryFn ran without enabled gate");
 *       return fetchX(id);
 *     },
 *   });
 */
export function invariant(
  condition: unknown,
  message: string | (() => string) = "Invariant failed"
): asserts condition {
  if (condition) return;
  const msg = typeof message === "function" ? message() : message;
  throw new Error(`Invariant failed: ${msg}`);
}
