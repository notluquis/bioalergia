import { ListBox, Popover, type Selection } from "@heroui/react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { Check, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export interface EmployeeMultiSelectOption {
  id: number;
  label: string;
}

interface EmployeeMultiSelectPopoverProps {
  options: EmployeeMultiSelectOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  buttonLabel: string;
  className?: string;
  emptyLabel?: string;
  maxSelected?: number;
  placeholder?: string;
}

export function EmployeeMultiSelectPopover({
  options,
  selectedIds,
  onChange,
  buttonLabel,
  className,
  emptyLabel = "No hay resultados",
  maxSelected,
  placeholder = "Buscar...",
}: Readonly<EmployeeMultiSelectPopoverProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, { wait: 150 });

  const selectedKeys = useMemo(() => new Set(selectedIds.map((id) => String(id))), [selectedIds]);

  const filteredOptions = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return options;
    }
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [debouncedSearch, options]);

  const disabledKeys = useMemo(() => {
    if (!maxSelected || selectedIds.length < maxSelected) {
      return undefined;
    }
    return new Set(
      options.filter((opt) => !selectedIds.includes(opt.id)).map((opt) => String(opt.id)),
    );
  }, [maxSelected, options, selectedIds]);

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      const capped = maxSelected ? options.slice(0, maxSelected) : options;
      onChange(capped.map((opt) => opt.id));
      return;
    }
    const nextIds = Array.from(keys).map((key) => Number(key));
    onChange(nextIds);
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <div className={cn("w-full", className)}>
        <Popover.Trigger>
          <Button className="w-full justify-between" size="sm" variant="outline">
            <span>{buttonLabel}</span>
            <Search className="h-4 w-4 opacity-60" />
          </Button>
        </Popover.Trigger>
      </div>
      <Popover.Content
        className="max-h-[70svh] w-[min(92vw,420px)] overflow-hidden rounded-xl border border-default-200 bg-background p-0 shadow-xl"
        offset={8}
        placement="bottom"
      >
        <Popover.Dialog className="space-y-2 p-3">
          <Input
            className="w-full"
            placeholder={placeholder}
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="max-h-72 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-default-400 text-sm">{emptyLabel}</div>
            ) : (
              <ListBox
                aria-label="Seleccionar empleados"
                disabledKeys={disabledKeys}
                selectedKeys={selectedKeys}
                selectionMode="multiple"
                onSelectionChange={handleSelectionChange}
              >
                {filteredOptions.map((opt) => (
                  <ListBox.Item
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm data-[focus-visible=true]:ring-primary/30"
                    id={String(opt.id)}
                    key={opt.id}
                    textValue={opt.label}
                  >
                    <span className="truncate">{opt.label}</span>
                    <ListBox.ItemIndicator>
                      {({ isSelected }) =>
                        isSelected ? <Check className="h-4 w-4 text-primary" /> : null
                      }
                    </ListBox.ItemIndicator>
                  </ListBox.Item>
                ))}
              </ListBox>
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
