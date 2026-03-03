import type { Selection } from "@heroui/react";
import { Button, Dropdown, Input, Label, TextField } from "@heroui/react";
import type { Table } from "@tanstack/react-table";
import { Check, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

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

  const selectedKeys = useMemo(() => {
    const keys = columns.filter((column) => column.getIsVisible()).map((column) => column.id);
    return new Set(keys);
  }, [columns]);

  const handleSelectionChange = (keys: Selection) => {
    const nextKeys = keys === "all" ? new Set(columns.map((column) => column.id)) : new Set(keys);
    columns.forEach((column) => {
      column.toggleVisibility(nextKeys.has(column.id));
    });
  };

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button className="ml-auto h-8" size="sm" variant="outline">
          <Settings2 className="mr-2 h-4 w-4" />
          Columnas
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-55" placement="bottom end">
        <div className="border-default-200/60 border-b p-2">
          <TextField>
            <Input
              className="h-8"
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
              placeholder="Buscar..."
              value={search}
            />
          </TextField>
        </div>
        <Dropdown.Menu
          aria-label="Toggle columns"
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          onSelectionChange={handleSelectionChange}
        >
          {filteredColumns.map((column) => {
            const label =
              typeof column.columnDef.header === "string" ? column.columnDef.header : column.id;
            return (
              <Dropdown.Item id={column.id} key={column.id} textValue={label}>
                <Dropdown.ItemIndicator>
                  {({ isSelected }) =>
                    isSelected ? <Check className="h-4 w-4 text-primary" /> : null
                  }
                </Dropdown.ItemIndicator>
                <Label>{label}</Label>
              </Dropdown.Item>
            );
          })}
          {filteredColumns.length === 0 && (
            <Dropdown.Item id="empty" isDisabled textValue="No encontrado">
              <span className="p-2 text-center text-muted-foreground text-sm">No encontrado</span>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
