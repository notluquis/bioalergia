import { useMemo } from "react";

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

  return (
    <details className="relative" data-multiselect>
      <summary className="glass-input flex cursor-pointer select-none list-none items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="rounded-full bg-white/70 px-2 py-1 text-[11px] text-slate-500">{displayLabel}</span>
      </summary>
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
    </details>
  );
}

export type MultiSelectOption = Option;
