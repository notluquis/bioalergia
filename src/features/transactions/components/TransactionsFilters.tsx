import Button from "../../../components/Button";
import type { Filters } from "../types";

type TransactionsFiltersProps = {
  filters: Filters;
  loading: boolean;
  onChange: (update: Partial<Filters>) => void;
  onSubmit: () => void;
};

export function TransactionsFilters({ filters, loading, onChange, onSubmit }: TransactionsFiltersProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="grid gap-4 p-6 text-xs text-base-content lg:grid-cols-4 bg-base-100"
    >
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Fecha desde</span>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => onChange({ from: event.target.value })}
          className="input input-bordered"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Fecha hasta</span>
        <input
          type="date"
          value={filters.to}
          onChange={(event) => onChange({ to: event.target.value })}
          className="input input-bordered"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Descripción</span>
        <input
          type="text"
          value={filters.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className="input input-bordered"
          placeholder="Contiene..."
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">ID transacción</span>
        <input
          type="text"
          value={filters.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          className="input input-bordered"
          placeholder="SOURCE_ID"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Desde</span>
        <input
          type="text"
          value={filters.origin}
          onChange={(event) => onChange({ origin: event.target.value })}
          className="input input-bordered"
          placeholder="Origen"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Hacia</span>
        <input
          type="text"
          value={filters.destination}
          onChange={(event) => onChange({ destination: event.target.value })}
          className="input input-bordered"
          placeholder="Destino"
        />
      </label>
      <label className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Tipo</span>
        <select
          value={filters.direction}
          onChange={(event) => onChange({ direction: event.target.value as Filters["direction"] })}
          className="select select-bordered"
        >
          <option value="">Todos</option>
          <option value="IN">Ingreso</option>
          <option value="OUT">Egreso</option>
          <option value="NEUTRO">Neutro</option>
        </select>
      </label>
      <div className="flex items-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Filtrando..." : "Aplicar filtros"}
        </Button>
      </div>
    </form>
  );
}
