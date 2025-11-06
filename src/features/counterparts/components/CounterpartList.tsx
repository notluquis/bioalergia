import type { Counterpart, CounterpartCategory } from "../types";
import Button from "../../../components/Button";
import { formatRut } from "../../../lib/rut";

interface CounterpartListProps {
  counterparts: Counterpart[];
  selectedId: number | null;
  onSelectCounterpart: (id: number | null) => void;
}

const CATEGORY_OPTIONS: Array<{ value: CounterpartCategory; label: string }> = [
  { value: "SUPPLIER", label: "Proveedor" },
  { value: "PATIENT", label: "Paciente" },
  { value: "EMPLOYEE", label: "Empleado" },
  { value: "PARTNER", label: "Socio" },
  { value: "RELATED", label: "Relacionado a socio" },
  { value: "OTHER", label: "Otro" },
];

const CATEGORY_LABELS = CATEGORY_OPTIONS.reduce<Record<string, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

export default function CounterpartList({ counterparts, selectedId, onSelectCounterpart }: CounterpartListProps) {
  return (
    <aside className="surface-recessed flex h-full flex-col gap-4 p-5 text-sm text-base-content">
      <header className="flex items-center justify-between gap-3">
        <h2 className="typ-caption text-base-content/80">Contrapartes</h2>
        <Button size="xs" onClick={() => onSelectCounterpart(null)}>
          Nueva
        </Button>
      </header>
      <ul className="muted-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {counterparts.map((item) => {
          const isActive = selectedId === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelectCounterpart(item.id)}
                className={`group w-full rounded-2xl border px-3 py-2 text-left transition-all ${
                  isActive
                    ? "border-primary/40 bg-primary/10 text-primary shadow-sm"
                    : "border-transparent bg-base-200/60 text-base-content hover:border-base-300 hover:bg-base-200"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="block font-medium tracking-tight">{item.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                      isActive ? "bg-primary/15 text-primary" : "bg-base-300/60 text-base-content/60"
                    }`}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </span>
                {item.rut && <span className="mt-1 block text-xs text-base-content/90">RUT {formatRut(item.rut)}</span>}
              </button>
            </li>
          );
        })}
        {!counterparts.length && (
          <li className="rounded-xl border border-base-300 bg-base-200 px-3 py-2 text-xs text-base-content/60">
            No hay registros aún.
          </li>
        )}
      </ul>
    </aside>
  );
}
