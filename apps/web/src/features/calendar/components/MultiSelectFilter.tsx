import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { ChevronDown } from "lucide-react";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  className?: string;
  label: string;
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  selected: string[];
}

export function MultiSelectFilter({
  className,
  label,
  onChange,
  options,
  placeholder = "Seleccionar",
  selected,
}: Readonly<MultiSelectFilterProps>) {
  const selectedKeys = new Set(selected);

  // Derived display text logic
  const getDisplayText = () => {
    if (selected.length === 0) {
      return placeholder;
    }

    const matches = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label.split(" · ")[0]);

    if (matches.length === 0) {
      return placeholder;
    }

    const preview = matches.slice(0, 2).join(", ");
    if (matches.length > 2) {
      return `${preview} +${matches.length - 2}`;
    }
    return preview;
  };

  const displayText = getDisplayText();

  return (
    <div className={className}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold tracking-wider text-base-content/70 uppercase">
          {label}
        </span>
      )}
      <Dropdown>
        <DropdownTrigger>
          <Button
            className="flex h-10 w-full min-w-0 items-center justify-between rounded-md border border-base-content/20 bg-base-100/50 px-3 py-2 text-sm text-base-content/90 hover:bg-base-100 focus:bg-base-100"
            variant="ghost"
          >
            <span className="truncate font-medium">{displayText}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-base-content/50" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label={label}
          selectedKeys={selectedKeys}
          selectionMode="multiple"
          onSelectionChange={(keys) => {
            if (keys === "all") {
              onChange(options.map((o) => o.value));
            } else {
              onChange(Array.from(keys) as string[]);
            }
          }}
          className="max-h-60 overflow-y-auto"
        >
          {options.map((option) => (
            <DropdownItem key={option.value} textValue={option.label.split(" · ")[0]}>
              {option.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
