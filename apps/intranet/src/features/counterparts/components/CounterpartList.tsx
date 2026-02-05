import { Button } from "@/components/ui/Button";
import { formatRut } from "@/lib/rut";

import type { Counterpart, CounterpartCategory } from "../types";

interface CounterpartListProps {
  className?: string;
  counterparts: Counterpart[];
  onSelectCounterpart: (id: null | number) => void;
  selectedId: null | number;
}

const CATEGORY_OPTIONS: { label: string; value: CounterpartCategory }[] = [
  { label: "Proveedor", value: "SUPPLIER" },
  { label: "Paciente", value: "PATIENT" },
  { label: "Empleado", value: "EMPLOYEE" },
  { label: "Socio", value: "PARTNER" },
  { label: "Relacionado a socio", value: "RELATED" },
  { label: "Otro", value: "OTHER" },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});
export function CounterpartList({
  className,
  counterparts,
  onSelectCounterpart,
  selectedId,
}: CounterpartListProps) {
  return (
    <aside
      className={`surface-recessed flex h-full min-h-0 flex-col gap-4 overflow-hidden p-5 text-foreground text-sm ${className ?? ""}`}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="typ-caption text-default-700">Contrapartes</h2>
        <Button
          onClick={() => {
            onSelectCounterpart(null);
          }}
          size="xs"
        >
          Nueva
        </Button>
      </header>
      <ul className="muted-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {counterparts.map((item) => {
          const isActive = selectedId === item.id;
          return (
            <li key={item.id}>
              <button
                className={`group w-full cursor-pointer rounded-2xl border px-3 py-2 text-left transition-all ${
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-default-50/60 text-foreground hover:border-default-200 hover:bg-default-50"
                }`}
                onClick={() => {
                  onSelectCounterpart(item.id);
                }}
                type="button"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="block font-medium tracking-tight">{item.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-semibold text-xs uppercase tracking-wide ${
                      isActive ? "bg-primary/15 text-primary" : "bg-default-100/60 text-default-500"
                    }`}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </span>
                {item.rut && (
                  <span className="mt-1 block text-foreground/90 text-xs">
                    RUT {formatRut(item.rut)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
        {counterparts.length === 0 && (
          <li className="rounded-xl border border-default-200 bg-default-50 px-3 py-2 text-default-500 text-xs">
            No hay registros aún.
          </li>
        )}
      </ul>
    </aside>
  );
}
