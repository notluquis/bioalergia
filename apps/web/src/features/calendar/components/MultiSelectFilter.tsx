import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

export interface MultiSelectOption {
  label: string;
  value: string;
}

export function MultiSelectFilter({
  label,
  onToggle,
  options,
  placeholder,
  selected,
}: Readonly<{
  label: string;
  onToggle: (value: string) => void;
  options: MultiSelectOption[];
  placeholder: string;
  selected: string[];
}>) {
  // React Compiler auto-memoizes derived values
  const getDisplayText = () => {
    if (selected.length === 0) {
      return { displayText: placeholder, fullText: placeholder };
    }

    const matches = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label.split(" · ")[0]);

    if (matches.length === 0) {
      return { displayText: placeholder, fullText: placeholder };
    }

    const preview = matches
      .slice(0, 2)
      .map((value) => truncateLabel(value ?? ""))
      .join(", ");
    const full = matches.join(", ");

    if (matches.length > 2) {
      return { displayText: `${preview} +${matches.length - 2}`, fullText: full };
    }

    return { displayText: preview || placeholder, fullText: full || placeholder };
  };

  const { displayText, fullText } = getDisplayText();

  const labelClasses = "label pt-0 pb-2";
  const labelTextClasses =
    "label-text text-xs font-semibold uppercase tracking-wider text-base-content/70 ml-1";

  return (
    <div className="form-control w-full">
      <label className={labelClasses}>
        <span className={labelTextClasses}>{label}</span>
      </label>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="input input-bordered bg-base-100/50 text-base-content hover:bg-base-100 focus:bg-base-100 focus:ring-primary/20 focus:border-primary ease-apple flex h-10 w-full cursor-pointer items-center justify-between gap-3 text-sm transition-all duration-200 select-none focus:ring-2 focus:outline-none"
            title={fullText}
            type="button"
          >
            <span className="text-base-content/90 truncate font-medium">{displayText}</span>
            <ChevronDown className="text-base-content/50 h-4 w-4 shrink-0 transition-opacity" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-[--radix-dropdown-menu-trigger-width] min-w-50"
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 ? (
              <div className="text-base-content/50 px-2 py-2 text-xs">Sin datos disponibles</div>
            ) : (
              options.map((option) => {
                const [namePart = "", metaPart] = option.label.split(" · ");
                const truncatedName = truncateLabel(namePart);
                return (
                  <DropdownMenuCheckboxItem
                    checked={selected.includes(option.value)}
                    key={option.value}
                    onSelect={(e) => {
                      e.preventDefault();
                      onToggle(option.value);
                    }}
                  >
                    <span className="flex flex-col text-left">
                      <span className="text-base-content truncate font-medium" title={namePart}>
                        {truncatedName || placeholder}
                      </span>
                      {metaPart && (
                        <span className="text-base-content/50 text-xs" title={metaPart}>
                          · {metaPart}
                        </span>
                      )}
                    </span>
                  </DropdownMenuCheckboxItem>
                );
              })
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function truncateLabel(text: string, max = 32) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
