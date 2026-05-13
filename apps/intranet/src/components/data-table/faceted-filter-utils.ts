import type { Selection as TableSelection } from "@heroui/react";

export interface FacetedFilterOption {
  readonly label: string;
  readonly value: string;
}

/**
 * Filter the available options by a search string (case-insensitive label match).
 */
export function filterOptionsBySearch<T extends FacetedFilterOption>(
  options: readonly T[],
  search: string
): T[] {
  const needle = search.toLowerCase();
  return options.filter((option) => option.label.toLowerCase().includes(needle));
}

/**
 * Resolve the next column filter value for a faceted filter, given the
 * incoming HeroUI selection. Returns `undefined` to clear the filter.
 */
export function resolveFacetedFilterValue(
  options: readonly FacetedFilterOption[],
  keys: TableSelection
): string[] | undefined {
  const nextKeys =
    keys === "all" ? new Set(options.map((option) => option.value)) : new Set(keys);

  if (nextKeys.has("clear")) return undefined;
  if (nextKeys.size === 0) return undefined;

  return [...nextKeys].map((key) => String(key));
}

/**
 * Predicate used by the column visibility search box.
 */
export function matchesColumnSearch(header: string, id: string, search: string): boolean {
  const needle = search.toLowerCase();
  return header.toLowerCase().includes(needle) || id.toLowerCase().includes(needle);
}
