import { Pagination } from "@heroui/react";
import { buildPaginationItems } from "@/components/pagination/pagination-items";

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
  const pageItems = buildPaginationItems({
    currentPage,
    totalPages,
  });

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
          )
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
