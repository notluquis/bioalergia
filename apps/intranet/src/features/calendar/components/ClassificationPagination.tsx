import Button from "@/components/ui/Button";

interface ClassificationPaginationProps {
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export function ClassificationPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  loading,
  onPageChange,
}: ClassificationPaginationProps) {
  if (totalCount <= pageSize) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <Button
        className="disabled:opacity-30"
        isDisabled={page === 0 || loading}
        isIconOnly
        onClick={() => onPageChange(0)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </Button>
      <Button
        className="disabled:opacity-30"
        isDisabled={page === 0 || loading}
        isIconOnly
        onClick={() => onPageChange(Math.max(0, page - 1))}
        size="sm"
        type="button"
        variant="ghost"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </Button>
      <div className="flex items-center gap-2 rounded-lg bg-default-50 px-4 py-2 text-sm">
        <span className="text-default-500">Página</span>
        <span className="font-semibold text-foreground tabular-nums">{page + 1}</span>
        <span className="text-default-500">de {totalPages}</span>
      </div>
      <Button
        className="disabled:opacity-30"
        isDisabled={(page + 1) * pageSize >= totalCount || loading}
        isIconOnly
        onClick={() => onPageChange(page + 1)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
        </svg>
      </Button>
      <Button
        className="disabled:opacity-30"
        isDisabled={(page + 1) * pageSize >= totalCount || loading}
        isIconOnly
        onClick={() => onPageChange(totalPages - 1)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M13 5l7 7-7 7M5 5l7 7-7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
        </svg>
      </Button>
    </div>
  );
}
