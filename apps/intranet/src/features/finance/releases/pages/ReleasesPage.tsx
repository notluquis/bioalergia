import { SearchField } from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import { TableRegion } from "@/components/data-table/TableRegion";
import { financeKeys } from "@/features/finance/queries";

import { columns } from "../components/ReleaseColumns";
export function ReleasesPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchInput, { wait: 500 });

  const { data } = useSuspenseQuery(financeKeys.releases(page + 1, pageSize, debouncedSearch));

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="w-full max-w-sm">
          <SearchField
            onChange={(value) => {
              setSearchInput(value);
              setPage(0);
            }}
            value={searchInput}
            variant="secondary"
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Buscar por ID, referencia..." />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
        </div>
      </div>

      <TableRegion>
        <DataTable
          columns={columns}
          containerVariant="plain"
          data={data.data}
          enableExport={false}
          enableGlobalFilter={false}
          initialPinning={{ left: ["expander", "sourceId"], right: [] }}
          onPaginationChange={(updater: Updater<PaginationState>) => {
            if (typeof updater === "function") {
              const newState = updater({ pageIndex: page, pageSize });
              setPage(newState.pageIndex);
              setPageSize(newState.pageSize);
            } else {
              setPage(updater.pageIndex);
              setPageSize(updater.pageSize);
            }
          }}
          pageCount={data.totalPages}
          pagination={{
            pageIndex: page,
            pageSize: pageSize,
          }}
          scrollMaxHeight="var(--table-region-height)"
        />
      </TableRegion>
    </div>
  );
}
