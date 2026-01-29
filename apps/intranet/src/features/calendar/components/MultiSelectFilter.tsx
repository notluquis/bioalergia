import {
  Button,
  Dropdown,
  DropdownPopover,
  DropdownTrigger,
  ListBox,
  type Selection,
} from "@heroui/react";
import { Check, ChevronDown } from "lucide-react";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface MultiSelectFilterProps {
  className?: string;
  density?: "comfortable" | "compact";
  label: string;
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  placeholder?: string;
  selected: string[];
}

export function MultiSelectFilter({
  className,
  density = "comfortable",
  label,
  onChange,
  options,
  placeholder = "Seleccionar",
  selected,
}: Readonly<MultiSelectFilterProps>) {
  const selectedKeys = new Set(selected);
  const isCompact = density === "compact";

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

  const handleSelectionChange = (keys: Selection) => {
    if (keys === "all") {
      onChange(options.map((o) => o.value));
    } else {
      onChange(Array.from(keys) as string[]);
    }
  };

  return (
    <div className={className}>
      {label && (
        <span
          className={`block font-semibold tracking-wider text-foreground-600 uppercase ${
            isCompact ? "mb-1 text-[10px]" : "mb-1.5 text-xs"
          }`}
        >
          {label}
        </span>
      )}
      <Dropdown>
        <DropdownTrigger>
          <Button
            className={`flex w-full min-w-0 items-center justify-between rounded-md border border-default-200 bg-content1/50 px-3 py-2 text-foreground hover:bg-content1 focus:bg-content1 ${
              isCompact ? "h-9 text-[13px]" : "h-10 text-sm"
            }`}
            variant="ghost"
          >
            <span className="truncate font-medium">{displayText}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-foreground-500" />
          </Button>
        </DropdownTrigger>
        <DropdownPopover>
          <ListBox
            aria-label={label}
            selectedKeys={selectedKeys}
            selectionMode="multiple"
            onSelectionChange={handleSelectionChange}
            className="max-h-60 w-[var(--radix-dropdown-menu-trigger-width)] max-w-[min(90vw,320px)] overflow-y-auto"
          >
            {options.map((option) => (
              <ListBox.Item key={option.value} textValue={option.label.split(" · ")[0]}>
                <div className="flex items-center justify-between">
                  <span>{option.label}</span>
                  <ListBox.ItemIndicator>
                    {({ isSelected }) =>
                      isSelected ? <Check className="h-4 w-4 text-primary" /> : null
                    }
                  </ListBox.ItemIndicator>
                </div>
              </ListBox.Item>
            ))}
          </ListBox>
        </DropdownPopover>
      </Dropdown>
    </div>
  );
}
