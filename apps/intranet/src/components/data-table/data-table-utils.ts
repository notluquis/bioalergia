import type { SortDescriptor } from "@heroui/react";
import type { Selection as TableSelection } from "@heroui/react";
import type { RowSelectionState, SortingState } from "@tanstack/react-table";

/**
 * Resolve a stable row id from arbitrary record-like data.
 * Falls back to `id` / `employeeId` / `_id`, then `row_<index>`.
 */
export function getStableRowId(originalRow: unknown, index: number): string {
  const row = (originalRow ?? {}) as Record<string, unknown>;
  type RowIdValue = number | string | undefined;
  const id =
    (row.id as RowIdValue)?.toString() ??
    (row.employeeId as RowIdValue)?.toString() ??
    (row._id as RowIdValue)?.toString();
  return id !== undefined && id.length > 0 ? id : `row_${index}`;
}

/**
 * Convert a TanStack `SortingState` to a HeroUI `SortDescriptor`.
 * Returns undefined when there is no active sort.
 */
export function sortingStateToDescriptor(sorting: SortingState): SortDescriptor | undefined {
  const first = sorting[0];
  if (!first) return undefined;
  return {
    column: first.id,
    direction: first.desc ? "descending" : "ascending",
  };
}

/**
 * Convert a HeroUI `SortDescriptor` (or null) to TanStack `SortingState`.
 */
export function descriptorToSortingState(
  descriptor: SortDescriptor | null | undefined
): SortingState {
  if (!descriptor?.column) return [];
  return [
    {
      desc: descriptor.direction === "descending",
      id: String(descriptor.column),
    },
  ];
}

/**
 * Compute the set of selected row keys from a `RowSelectionState` map.
 */
export function rowSelectionToKeys(rowSelection: RowSelectionState): Set<string> {
  return new Set(
    Object.entries(rowSelection)
      .filter(([, isSelected]) => Boolean(isSelected))
      .map(([rowId]) => rowId)
  );
}

/**
 * Apply a HeroUI selection update for a set of visible row ids onto
 * a previous `RowSelectionState`. Pure: returns a new state object.
 */
export function applyVisibleSelection(
  prev: RowSelectionState,
  visibleRowIds: readonly string[],
  keys: TableSelection
): RowSelectionState {
  const next: RowSelectionState = { ...prev };
  for (const rowId of visibleRowIds) {
    delete next[rowId];
  }

  if (keys === "all") {
    for (const rowId of visibleRowIds) {
      next[rowId] = true;
    }
    return next;
  }

  for (const key of keys) {
    next[String(key)] = true;
  }
  return next;
}

/**
 * Resolve the "effective" scroll mode given a user-selected mode and
 * whether pagination is enabled. When pagination is disabled and mode
 * is "auto", we promote to "container" so scroll lives inside the table.
 */
export function resolveScrollMode(
  scrollMode: "auto" | "container" | "page",
  enablePagination: boolean
): "auto" | "container" | "page" {
  return scrollMode === "auto" && !enablePagination ? "container" : scrollMode;
}

/**
 * Decide whether internal vertical scroll should be enabled inside the table.
 */
export function shouldEnableInternalScroll(params: {
  enableVirtualization: boolean;
  hasPagination: boolean;
  scrollMaxHeight: number | string | undefined;
  scrollMode: "auto" | "container" | "page";
}): boolean {
  const { enableVirtualization, hasPagination, scrollMaxHeight, scrollMode } = params;
  if (scrollMode === "container") return true;
  if (scrollMode === "page") return false;
  return Boolean(scrollMaxHeight) || enableVirtualization || !hasPagination;
}

/**
 * Decide whether row virtualization should activate based on configuration.
 */
export function shouldVirtualizeRows(params: {
  enableVirtualization: boolean;
  hasRenderSubComponent: boolean;
  rowCount: number;
  threshold: number;
}): boolean {
  const { enableVirtualization, hasRenderSubComponent, rowCount, threshold } = params;
  return enableVirtualization && rowCount >= threshold && !hasRenderSubComponent;
}

/**
 * Test if a column id should be excluded from CSV exports / view options.
 */
export function isUtilityColumnId(id: string): boolean {
  return id === "actions" || id === "select";
}

/**
 * Resolve a human-readable column label, falling back to the column id.
 */
export function getColumnLabel(header: unknown, id: string): string {
  return typeof header === "string" ? header : id;
}

/**
 * Generate the default CSV export filename for a given date.
 */
export function buildExportFilename(date: Date = new Date()): string {
  return `export-${date.toISOString().slice(0, 10)}.csv`;
}
