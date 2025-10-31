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
    <aside className="flex h-full flex-col gap-4 p-5 text-sm text-slate-600 bg-base-100">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500/90">Contrapartes</h2>
        <Button size="xs" onClick={() => onSelectCounterpart(null)}>
          Nueva
        </Button>
      </header>
      <ul className="muted-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
        {counterparts.map((item) => {
          const isActive = selectedId === item.id;
          return (
            <li key={item.id}>
              <Button
                type="button"
                variant={isActive ? "primary" : "secondary"}
                onClick={() => onSelectCounterpart(item.id)}
                className={`group w-full rounded-2xl border px-3 py-2 text-left transition-all ${
                    isActive
                      ? "border-white/70 bg-[var(--brand-primary)]/18 text-[var(--brand-primary)] shadow-[0_14px_28px_-22px_rgba(14,100,183,0.8)]"
                      : "border-transparent bg-base-100/35 text-slate-600 hover:border-white/60 hover:bg-base-100/55"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="block font-medium tracking-tight">{item.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      isActive ? "bg-base-100/70 text-[var(--brand-primary)]" : "bg-base-100/55 text-slate-500"
                    }`}
                  >
                    {CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </span>
                {item.rut && (
                  <span className="mt-1 block text-[11px] text-slate-500/90">RUT {formatRut(item.rut)}</span>
                )}
              </Button>
            </li>
          );
        })}
        {!counterparts.length && (
          <li className="rounded-xl border border-white/55 bg-base-100/60 px-3 py-2 text-xs text-slate-500">
            No hay registros aún.
          </li>
        )}
      </ul>
    </aside>
  );
}
