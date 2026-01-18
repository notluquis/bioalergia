import { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import Input from "@/components/ui/Input";

interface DataTableViewOptionsProps<TData> {
  readonly table: Table<TData>;
}

export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
  const [search, setSearch] = useState("");

  const columns = table.getAllColumns().filter((column) => column.accessorFn !== undefined && column.getCanHide());

  const filteredColumns = columns.filter((c) => {
    // Try to find a human readable label usually stored in columnDef.header if it's a string
    const header = typeof c.columnDef.header === "string" ? c.columnDef.header : c.id;
    return header.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="ml-auto hidden h-8 lg:flex" size="sm" variant="outline">
          <Settings2 className="mr-2 h-4 w-4" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex max-h-100 w-50 flex-col">
        <DropdownMenuLabel>Alternar columnas</DropdownMenuLabel>
        <div className="border-b px-2 py-2">
          <Input
            className="h-8"
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }} // Prevent closing on space
            placeholder="Buscar..."
            value={search}
          />
        </div>
        <div className="flex-1 overflow-y-auto p-1">
          {filteredColumns.map((column) => {
            const label = typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
            return (
              <DropdownMenuCheckboxItem
                checked={column.getIsVisible()}
                className="capitalize"
                key={column.id}
                onCheckedChange={(value) => {
                  column.toggleVisibility(value);
                }}
                onSelect={(e) => {
                  e.preventDefault();
                }}
              >
                {label}
              </DropdownMenuCheckboxItem>
            );
          })}
          {filteredColumns.length === 0 && (
            <div className="text-muted-foreground p-2 text-center text-sm">No encontrado</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
