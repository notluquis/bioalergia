import { Pagination } from "@heroui/react";

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

  const currentPage = page + 1;
  const canPrevious = currentPage > 1;
  const canNext = currentPage < totalPages;
  const pages: Array<"ellipsis" | number> = [];
  if (totalPages <= 7) {
    for (let p = 1; p <= totalPages; p += 1) {
      pages.push(p);
    }
  } else {
    pages.push(1);
    if (currentPage > 3) {
      pages.push("ellipsis");
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let p = start; p <= end; p += 1) {
      pages.push(p);
    }
    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }
    pages.push(totalPages);
  }
  const pageItems = pages.reduce<Array<{ key: string; type: "ellipsis" | "page"; value?: number }>>(
    (acc, value) => {
      if (value === "ellipsis") {
        const ellipsisIndex = acc.filter((item) => item.type === "ellipsis").length + 1;
        acc.push({ key: `ellipsis-${ellipsisIndex}`, type: "ellipsis" });
      } else {
        acc.push({ key: `page-${value}`, type: "page", value });
      }
      return acc;
    },
    [],
  );

  return (
    <Pagination className="justify-center pt-4" size="sm">
      <Pagination.Summary>{`Página ${currentPage} de ${totalPages}`}</Pagination.Summary>
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={!canPrevious || loading}
            onPress={() => onPageChange(Math.max(0, page - 1))}
          >
            <Pagination.PreviousIcon />
            <span>Anterior</span>
          </Pagination.Previous>
        </Pagination.Item>
        {pageItems.map((item) =>
          item.type === "ellipsis" ? (
            <Pagination.Item key={item.key}>
              <Pagination.Ellipsis />
            </Pagination.Item>
          ) : (
            <Pagination.Item key={item.key}>
              <Pagination.Link
                isActive={item.value === currentPage}
                onPress={() => onPageChange((item.value ?? 1) - 1)}
              >
                {item.value}
              </Pagination.Link>
            </Pagination.Item>
          ),
        )}
        <Pagination.Item>
          <Pagination.Next isDisabled={!canNext || loading} onPress={() => onPageChange(page + 1)}>
            <span>Siguiente</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
