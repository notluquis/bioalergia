import { useEffect, useMemo, useRef } from "react";

import { useDisclosure } from "@/hooks/useDisclosure";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import Checkbox from "@/components/ui/Checkbox";

type Option = { value: string; label: string };

function truncateLabel(text: string, max = 32) {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  placeholder,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
  placeholder: string;
}) {
  const { displayText, fullText } = useMemo(() => {
    if (!selected.length) {
      return { displayText: placeholder, fullText: placeholder };
    }

    const matches = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label.split(" · ")[0]);

    if (!matches.length) {
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
  }, [options, placeholder, selected]);

  const containerRef = useRef<HTMLDivElement>(null);
  const { isOpen, toggle, close } = useDisclosure(false);

  useOutsideClick(
    containerRef,
    () => {
      close();
    },
    isOpen
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [close, isOpen]);

  const labelClasses = "label pt-0 pb-2";
  const labelTextClasses = "label-text text-xs font-semibold uppercase tracking-wider text-base-content/70 ml-1";

  return (
    <div ref={containerRef} className="form-control relative w-full" data-multiselect>
      <label className={labelClasses}>
        <span className={labelTextClasses}>{label}</span>
      </label>
      <button
        type="button"
        className="input input-bordered bg-base-100/50 text-base-content hover:bg-base-100 focus:bg-base-100 focus:ring-primary/20 focus:border-primary ease-apple flex h-10 w-full cursor-pointer items-center justify-between gap-3 text-sm transition-all duration-200 select-none focus:ring-2 focus:outline-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={toggle}
        title={fullText}
      >
        <span className="text-base-content/90 truncate font-medium">{displayText}</span>
        <svg
          className={`text-base-content/50 h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.08 1.04l-4.25 4.25a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="border-base-200 bg-base-100 absolute top-full left-0 z-20 mt-1 w-full space-y-2 rounded-2xl border p-2 shadow-xl">
          {options.length === 0 ? (
            <p className="text-base-content/50 text-xs">Sin datos disponibles</p>
          ) : (
            options.map((option) => {
              const [namePart = "", metaPart] = option.label.split(" · ");
              const truncatedName = truncateLabel(namePart);
              return (
                <Checkbox
                  key={option.value}
                  checked={selected.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                  className="text-base-content"
                  label={
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
                  }
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export type MultiSelectOption = Option;
