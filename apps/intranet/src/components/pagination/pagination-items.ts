export type PaginationRenderItem = { key: string; type: "ellipsis" | "page"; value?: number };

export function buildPaginationItems(params: {
  currentPage: number;
  totalPages: number;
}): PaginationRenderItem[] {
  const { currentPage, totalPages } = params;
  const normalizedCurrentPage = Math.max(1, Math.min(currentPage, Math.max(1, totalPages)));
  const normalizedTotalPages = Math.max(1, totalPages);
  const pages: Array<"ellipsis" | number> = [];

  if (normalizedTotalPages <= 7) {
    for (let page = 1; page <= normalizedTotalPages; page += 1) {
      pages.push(page);
    }
  } else {
    pages.push(1);
    if (normalizedCurrentPage > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, normalizedCurrentPage - 1);
    const end = Math.min(normalizedTotalPages - 1, normalizedCurrentPage + 1);
    for (let page = start; page <= end; page += 1) {
      pages.push(page);
    }

    if (normalizedCurrentPage < normalizedTotalPages - 2) {
      pages.push("ellipsis");
    }
    pages.push(normalizedTotalPages);
  }

  let ellipsisCount = 0;
  return pages.map((value) => {
    if (value === "ellipsis") {
      ellipsisCount += 1;
      return { key: `ellipsis-${ellipsisCount}`, type: "ellipsis" as const };
    }
    return { key: `page-${value}`, type: "page" as const, value };
  });
}
