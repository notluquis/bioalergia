import { Dropdown, Label, type Selection } from "@heroui/react";
import type { Column } from "@tanstack/react-table";
import { PlusCircle } from "lucide-react";
import { type ComponentType, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface DataTableFacetedFilterProps<TData, TValue> {
  readonly column?: Column<TData, TValue>;
  readonly options: {
    readonly icon?: ComponentType<{ className?: string }>;
    readonly label: string;
    readonly value: string;
  }[];
  readonly title?: string;
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  options,
  title,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues();
  const selectedValues = new Set((column?.getFilterValue() as string[] | undefined) ?? []);
  const [search, setSearch] = useState("");

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedKeys = new Set(selectedValues);

  const handleSelectionChange = (keys: Selection) => {
    const nextKeys =
      keys === "all" ? new Set(options.map((option) => option.value)) : new Set(keys);
    if (nextKeys.has("clear")) {
      column?.setFilterValue(undefined);
      return;
    }
    column?.setFilterValue(nextKeys.size > 0 ? [...nextKeys] : undefined);
  };

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button className="h-8 border-dashed" size="sm" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <div className="mx-2 h-4 w-px bg-default-100" />
              <div className="badge badge-sm badge-secondary hidden lg:flex">
                {selectedValues.size}
              </div>
              <div className="badge badge-sm badge-secondary flex lg:hidden">
                {selectedValues.size}
              </div>
            </>
          )}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-50 p-0" placement="bottom start">
        <div className="border-default-200/60 border-b p-2">
          <Input
            className="h-8"
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
            }}
            placeholder={title}
            value={search}
          />
        </div>
        <Dropdown.Menu
          aria-label={title}
          className="max-h-75 overflow-auto p-1"
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          onSelectionChange={handleSelectionChange}
        >
          {filteredOptions.length === 0 && (
            <Dropdown.Item id="empty" isDisabled textValue="No results found">
              <span className="py-6 text-center text-default-400 text-sm">No results found.</span>
            </Dropdown.Item>
          )}
          {filteredOptions.map((option) => (
            <Dropdown.Item id={option.value} key={option.value} textValue={option.label}>
              <Dropdown.ItemIndicator />
              {option.icon && <option.icon className="mr-2 h-4 w-4 opacity-50" />}
              <Label>{option.label}</Label>
              {facets?.get(option.value) && (
                <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                  {facets.get(option.value)}
                </span>
              )}
            </Dropdown.Item>
          ))}
          {selectedValues.size > 0 && (
            <Dropdown.Item id="clear" textValue="Clear filters">
              <Label>Clear filters</Label>
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
