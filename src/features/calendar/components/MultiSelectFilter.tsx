import { useEffect, useMemo, useRef } from "react";

import { useDisclosure } from "../../../hooks/useDisclosure";
import { useOutsideClick } from "../../../hooks/useOutsideClick";

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
      .map((value) => truncateLabel(value))
      .join(", ");
    const full = matches.join(", ");

    if (matches.length > 2) {
      return { displayText: `${preview} +${matches.length - 2}`, fullText: full };
    }

    return { displayText: preview || placeholder, fullText: full || placeholder };
  }, [options, placeholder, selected]);

  const containerRef = useRef<HTMLLabelElement>(null);
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

  return (
    <label ref={containerRef} className="relative flex flex-col gap-2 text-xs text-slate-600" data-multiselect>
      <span className="font-semibold uppercase tracking-wide text-slate-600/90">{label}</span>
      <button
        type="button"
        className="input input-bordered flex h-12 w-full cursor-pointer select-none items-center justify-between gap-3 text-sm text-slate-600"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={toggle}
        title={fullText}
      >
        <span className="truncate font-medium text-slate-700">{displayText}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute z-20 mt-2 w-full space-y-2 rounded-2xl border border-white/60 bg-base-100/95 p-3 shadow-lg">
          {options.length === 0 ? (
            <p className="text-[11px] text-slate-400">Sin datos disponibles</p>
          ) : (
            options.map((option) => {
              const [namePart = "", metaPart] = option.label.split(" · ");
              const truncatedName = truncateLabel(namePart);
              return (
                <label key={option.value} className="flex items-center gap-3 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={selected.includes(option.value)}
                    onChange={() => onToggle(option.value)}
                  />
                  <span className="flex flex-col text-left">
                    <span className="truncate font-medium text-slate-700" title={namePart}>
                      {truncatedName || placeholder}
                    </span>
                    {metaPart && (
                      <span className="text-[11px] text-slate-400" title={metaPart}>
                        · {metaPart}
                      </span>
                    )}
                  </span>
                </label>
              );
            })
          )}
        </div>
      )}
    </label>
  );
}

export type MultiSelectOption = Option;
