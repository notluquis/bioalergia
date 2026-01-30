import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownPopover,
  HeroDropdownMenu,
} from "@/components/ui/DropdownMenu";
import Input from "@/components/ui/Input";

interface DataTableViewOptionsProps<TData> {
  readonly table: Table<TData>;
}

export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
  const [search, setSearch] = useState("");

  const columns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanHide() && !["actions", "select"].includes(column.id));

  const filteredColumns = columns.filter((c) => {
    // Try to find a human readable label usually stored in columnDef.header if it's a string
    const header = typeof c.columnDef.header === "string" ? c.columnDef.header : c.id;
    return (
      header.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button className="ml-auto h-8" size="sm" variant="outline">
          <Settings2 className="mr-2 h-4 w-4" />
          Columnas
        </Button>
      </DropdownMenuTrigger>
      <DropdownPopover placement={"bottom-end" as any}>
        <HeroDropdownMenu aria-label="Toggle columns" className="w-37.5">
          <DropdownMenuLabel>Alternar columnas</DropdownMenuLabel>
          <DropdownMenuGroup className="border-b px-2 py-2">
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
          </DropdownMenuGroup>
          <DropdownMenuGroup className="flex-1 overflow-y-auto p-1">
            {filteredColumns.map((column) => {
              const label =
                typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
              return (
                <DropdownMenuCheckboxItem
                  className="capitalize"
                  checked={column.getIsVisible()}
                  key={column.id}
                  onCheckedChange={(checked) => column.toggleVisibility(!!checked)}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              );
            })}
            {filteredColumns.length === 0 && (
              <DropdownMenuItem isDisabled>
                <div className="text-muted-foreground p-2 text-center text-sm">No encontrado</div>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </HeroDropdownMenu>
      </DropdownPopover>
    </DropdownMenu>
  );
}
