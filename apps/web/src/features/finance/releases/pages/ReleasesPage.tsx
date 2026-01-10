import { useQuery } from "@tanstack/react-query";
import { PaginationState, Updater } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { useDebounce } from "use-debounce";

import { DataTable } from "@/components/data-table/DataTable";
import Input from "@/components/ui/Input";
import { apiClient } from "@/lib/apiClient";

import { columns } from "../components/columns";
import { ListResponse } from "../types";

async function fetchReleases(page: number, pageSize: number, search?: string): Promise<ListResponse> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);

  return apiClient.get<ListResponse>(`/api/release-transactions?${params.toString()}`);
}

export default function ReleasesPage() {
  const [page, setPage] = useState(0);
  const [pageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch] = useDebounce(searchInput, 500);

  const { data, isLoading } = useQuery({
    queryKey: ["release-transactions", page, pageSize, debouncedSearch],
    queryFn: () => fetchReleases(page + 1, pageSize, debouncedSearch),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar por ID, referencia..."
            className="pl-9"
            value={searchInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              setSearchInput(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        pageCount={data?.totalPages || -1}
        pagination={{
          pageIndex: page,
          pageSize: pageSize,
        }}
        onPaginationChange={(updater: Updater<PaginationState>) => {
          if (typeof updater === "function") {
            const newState = updater({ pageIndex: page, pageSize });
            setPage(newState.pageIndex);
          } else {
            setPage(updater.pageIndex);
          }
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
