import { useState } from "react";

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface UsePaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  pageSizeOptions?: number[];
}

export function usePagination({
  initialPage = 1,
  initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
}: UsePaginationOptions = {}) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: initialPage,
    pageSize: initialPageSize,
  });

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const setPageSize = (pageSize: number) => {
    setPagination({ page: 1, pageSize }); // Reset to first page when changing page size
  };

  const nextPage = () => {
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
  };

  const prevPage = () => {
    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }));
  };

  const canGoNext = (total: number) => {
    return pagination.page * pagination.pageSize < total;
  };

  const canGoPrev = () => {
    return pagination.page > 1;
  };

  const getPageInfo = (total: number) => {
    const start = (pagination.page - 1) * pagination.pageSize + 1;
    const end = Math.min(pagination.page * pagination.pageSize, total);
    const totalPages = Math.ceil(total / pagination.pageSize);

    return { start, end, totalPages, total };
  };

  return {
    pagination,
    setPagination,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    canGoNext,
    canGoPrev,
    getPageInfo,
    pageSizeOptions,
  };
}
