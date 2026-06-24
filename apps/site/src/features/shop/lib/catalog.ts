// Pure catalog sorting logic, extracted from routes/tienda/index.tsx so it is
// unit-testable without a React renderer. Behavior is byte-identical to the
// original inline `sortProducts`.

/** The sort keys accepted by the tienda `?sort=` search param. */
export type SortKey = "relevancia" | "precio_asc" | "precio_desc";

/** Minimal structural shape sorting depends on — a product with a CLP price. */
export type Priced = { price_clp: number };

/**
 * Returns a new array of products sorted by the given key.
 *
 * - `precio_asc`  → ascending price (new array, original untouched).
 * - `precio_desc` → descending price (new array, original untouched).
 * - anything else (`relevancia` / unknown) → the original array, unsorted, as-is
 *   (server-supplied relevance order is preserved by reference).
 */
export function sortProducts<T extends Priced>(rows: T[], key: string): T[] {
  if (key === "precio_asc") return [...rows].sort((a, b) => a.price_clp - b.price_clp);
  if (key === "precio_desc") return [...rows].sort((a, b) => b.price_clp - a.price_clp);
  return rows;
}
