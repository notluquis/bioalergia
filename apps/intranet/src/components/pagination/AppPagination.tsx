import { Pagination } from "@heroui/react";
import { computePaginationView } from "@/components/data-table/pagination-utils";
import { buildPaginationItems } from "@/components/pagination/pagination-items";

interface AppPaginationProps {
  /** Página actual, 0-based. */
  readonly page: number;
  readonly pageSize: number;
  /** Total de ítems. Si se entrega, se oculta cuando totalCount <= pageSize. */
  readonly totalCount?: number;
  /**
   * Total de páginas. Si no se entrega, se deriva de totalCount/pageSize.
   * Usar `-1` (sentinel de TanStack) cuando el total es desconocido
   * (paginación server-side sin count) → muestra "Página N" sin total y
   * mantiene "Siguiente" habilitado.
   */
  readonly totalPages?: number;
  readonly loading?: boolean;
  /** Emite el índice de página 0-based. */
  readonly onPageChange: (page: number) => void;
  readonly className?: string;
  readonly showSummary?: boolean;
}

/**
 * Paginación presentacional única de la app (HeroUI v3 `<Pagination>`).
 *
 * Contrato 0-based en `page`/`onPageChange` (compat con la antigua
 * `ClassificationPagination`). Sirve para superficies SIN tabla TanStack
 * (grids de cards, server-side). Dentro del DataTable, `DataTablePagination`
 * deriva los valores de la tabla y delega aquí. Reutiliza los helpers puros
 * `computePaginationView` + `buildPaginationItems`.
 */
export function AppPagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  loading = false,
  onPageChange,
  className = "justify-center pt-4",
  showSummary = true,
}: AppPaginationProps) {
  const computedTotalPages =
    totalPages ?? (totalCount !== undefined ? Math.ceil(totalCount / Math.max(1, pageSize)) : -1);

  const view = computePaginationView({ computedTotalPages, pageIndex: page });
  const { canNext, canPrevious, currentPageNumber, hasKnownTotalPages, totalPages: pages } = view;

  // Ocultar sólo cuando SABEMOS que hay una sola página de datos.
  if (hasKnownTotalPages) {
    const singlePage = totalCount !== undefined ? totalCount <= pageSize : pages <= 1;
    if (singlePage) return null;
  }

  const pageItems = hasKnownTotalPages
    ? buildPaginationItems({ currentPage: currentPageNumber, totalPages: pages })
    : [];

  return (
    <Pagination className={className} size="sm">
      {showSummary && (
        <Pagination.Summary className="text-default-500 text-sm">
          {hasKnownTotalPages
            ? `Página ${currentPageNumber} de ${pages}`
            : `Página ${currentPageNumber}`}
        </Pagination.Summary>
      )}
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
                isActive={item.value === currentPageNumber}
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
