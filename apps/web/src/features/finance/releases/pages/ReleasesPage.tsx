import { useDebouncedValue } from "@tanstack/react-pacer";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { PaginationState, Updater } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import { DataTable } from "@/components/data-table/DataTable";
import Input from "@/components/ui/Input";
import { financeKeys } from "@/features/finance/queries";

import { columns } from "../components/ReleaseColumns";

export default function ReleasesPage() {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchInput, { wait: 500 });

  const { data } = useSuspenseQuery(financeKeys.releases(page + 1, pageSize, debouncedSearch));

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
          <Input
            className="pl-9"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSearchInput(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por ID, referencia..."
            value={searchInput}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data.data}
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
      />
    </div>
  );
}
