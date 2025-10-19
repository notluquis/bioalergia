import { useEffect, useMemo, useRef } from "react";

import { useDisclosure } from "../../../hooks/useDisclosure";
import { useOutsideClick } from "../../../hooks/useOutsideClick";

type Option = { value: string; label: string };

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
  const displayLabel = useMemo(() => {
    if (!selected.length) return placeholder;
    const matches = options
      .filter((option) => selected.includes(option.value))
      .map((option) => option.label.split(" · ")[0]);
    return matches.length ? matches.join(", ") : placeholder;
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

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2 text-sm text-slate-600" data-multiselect>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600/90">{label}</span>
      <button
        type="button"
        className="glass-input flex w-full cursor-pointer select-none items-center justify-between gap-2 text-xs text-slate-600"
        aria-haspopup="true"
        aria-expanded={isOpen}
        onClick={toggle}
      >
        <span className="truncate text-[13px] font-medium text-slate-700">{displayLabel}</span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute z-20 mt-2 w-full space-y-2 rounded-2xl border border-white/60 bg-white/95 p-3 shadow-lg">
          {options.length === 0 ? (
            <p className="text-[11px] text-slate-400">Sin datos disponibles</p>
          ) : (
            options.map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={selected.includes(option.value)}
                  onChange={() => onToggle(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export type MultiSelectOption = Option;
