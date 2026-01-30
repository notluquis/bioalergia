import type { Column } from "@tanstack/react-table";
import { PlusCircle } from "lucide-react";
import * as React from "react";

import Button from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownPopover,
  HeroDropdownMenu,
} from "@/components/ui/DropdownMenu";
import Input from "@/components/ui/Input";

interface DataTableFacetedFilterProps<TData, TValue> {
  readonly column?: Column<TData, TValue>;
  readonly options: {
    readonly icon?: React.ComponentType<{ className?: string }>;
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
  const selectedValues = new Set(column?.getFilterValue() as string[]);
  const [search, setSearch] = React.useState("");

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button className="h-8 border-dashed" size="sm" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          {title}
          {selectedValues.size > 0 && (
            <>
              <div className="bg-default-100 mx-2 h-4 w-px" />
              <div className="badge badge-sm badge-secondary hidden lg:flex">
                {selectedValues.size}
              </div>
              <div className="badge badge-sm badge-secondary flex lg:hidden">
                {selectedValues.size}
              </div>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownPopover placement={"bottom-start" as any}>
        <HeroDropdownMenu aria-label={title} className="w-50 p-0">
          <DropdownMenuGroup>
            <div className="p-1">
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
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup className="max-h-75 overflow-auto p-1">
            {filteredOptions.length === 0 && (
              <DropdownMenuItem isDisabled>
                <div className="text-default-400 py-6 text-center text-sm">No results found.</div>
              </DropdownMenuItem>
            )}
            {filteredOptions.map((option) => {
              const isSelected = selectedValues.has(option.value);
              return (
                <DropdownMenuCheckboxItem
                  checked={isSelected}
                  key={option.value}
                  onCheckedChange={() => {
                    if (isSelected) {
                      selectedValues.delete(option.value);
                    } else {
                      selectedValues.add(option.value);
                    }
                    const filterValues = [...selectedValues];
                    column?.setFilterValue(filterValues.length > 0 ? filterValues : undefined);
                  }}
                  onPress={() => {
                    // CheckboxItem handles logic
                  }}
                >
                  {option.icon && <option.icon className="mr-2 h-4 w-4 opacity-50" />}
                  <span>{option.label}</span>
                  {facets?.get(option.value) && (
                    <span className="ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs">
                      {facets.get(option.value)}
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuGroup>
          {selectedValues.size > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup className="p-1">
                <DropdownMenuItem
                  className="justify-center text-center"
                  onPress={() => column?.setFilterValue(undefined)}
                >
                  Clear filters
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </HeroDropdownMenu>
      </DropdownPopover>
    </DropdownMenu>
  );
}
