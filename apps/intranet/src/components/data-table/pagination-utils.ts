export interface PaginationView {
  canNext: boolean;
  canPrevious: boolean;
  currentPageIndex: number;
  currentPageNumber: number;
  hasKnownTotalPages: boolean;
  totalPages: number;
}

/**
 * Compute the derived pagination view for the DataTable pagination footer.
 * Pure: no React, no DOM, no table instance.
 */
export function computePaginationView(params: {
  computedTotalPages: number;
  pageIndex: number;
}): PaginationView {
  const { computedTotalPages, pageIndex } = params;
  const safePageIndex = Math.max(0, pageIndex);
  const hasKnownTotalPages = computedTotalPages !== -1;
  const totalPages = hasKnownTotalPages ? Math.max(1, computedTotalPages) : safePageIndex + 1;
  const canPrevious = safePageIndex > 0;
  const canNext = !hasKnownTotalPages || safePageIndex < totalPages - 1;
  const currentPageNumber = safePageIndex + 1;

  return {
    canNext,
    canPrevious,
    currentPageIndex: safePageIndex,
    currentPageNumber,
    hasKnownTotalPages,
    totalPages,
  };
}

/**
 * Merge the current page size into the available options, dedupe and sort.
 */
export function normalizePageSizeOptions(
  pageSizeOptions: readonly number[],
  currentPageSize: number
): number[] {
  return Array.from(new Set([...pageSizeOptions, currentPageSize])).sort((a, b) => a - b);
}

/**
 * Clamp a page index into the valid `[0, totalPages - 1]` window.
 */
export function clampPageIndex(pageIndex: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.max(0, Math.min(pageIndex, totalPages - 1));
}
