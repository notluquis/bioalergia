import { EmptyState } from "@heroui/react";
import type { ReactNode } from "react";

import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/** Minimal slice of a TanStack Query result PageState needs. Accepts any
 *  `useQuery`/`useSuspenseQuery` result without coupling to its full generics. */
interface QueryLike<T> {
  readonly data: T | undefined;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
}

interface PageStateProps<T> {
  readonly query: QueryLike<T>;
  /** Render the resolved, non-empty data. */
  readonly children: (data: T) => ReactNode;
  readonly loadingLabel?: string;
  /** Predicate for the empty state (e.g. `(rows) => rows.length === 0`). */
  readonly isEmpty?: (data: T) => boolean;
  readonly emptyTitle?: string;
  readonly emptyDescription?: ReactNode;
  readonly emptyIcon?: ReactNode;
  readonly errorTitle?: string;
}

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Standard loading / error / empty / data state machine for a query-backed
 * section. Collapses the ~113 ad-hoc `isLoading ? … : …` ternaries into one
 * primitive with consistent a11y (LoadingSpinner `role=status`, ErrorAlert
 * `Alert status=danger`, HeroUI `EmptyState`).
 *
 * ```tsx
 * <PageState query={rolesQuery} isEmpty={(r) => r.length === 0} emptyTitle="Sin roles">
 *   {(roles) => <DataTable data={roles} … />}
 * </PageState>
 * ```
 */
export function PageState<T>({
  query,
  children,
  loadingLabel = "Cargando",
  isEmpty,
  emptyTitle = "Sin resultados",
  emptyDescription,
  emptyIcon,
  errorTitle = "No se pudo cargar la información",
}: PageStateProps<T>) {
  if (query.isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <LoadingSpinner label={loadingLabel} />
      </div>
    );
  }

  if (query.isError) {
    return <ErrorAlert message={toMessage(query.error, errorTitle)} />;
  }

  if (query.data === undefined) {
    return null;
  }

  if (isEmpty?.(query.data)) {
    return (
      <EmptyState className="m-4 p-6 text-center">
        {emptyIcon ? <div className="mx-auto text-default-400">{emptyIcon}</div> : null}
        <p className="mt-2 font-medium text-sm">{emptyTitle}</p>
        {emptyDescription ? <p className="text-default-500 text-xs">{emptyDescription}</p> : null}
      </EmptyState>
    );
  }

  return <>{children(query.data)}</>;
}
