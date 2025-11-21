import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
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
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Fecha desde</span>
        <Input type="date" value={filters.from} onChange={(event) => onChange({ from: event.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Fecha hasta</span>
        <Input type="date" value={filters.to} onChange={(event) => onChange({ to: event.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Descripción</span>
        <Input
          type="text"
          value={filters.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Contiene..."
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">ID transacción</span>
        <Input
          type="text"
          value={filters.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          placeholder="SOURCE_ID"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Cuenta asociada</span>
        <Input
          type="text"
          value={filters.bankAccountNumber}
          onChange={(event) => onChange({ bankAccountNumber: event.target.value })}
          placeholder="Número de cuenta"
          inputMode="numeric"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Desde</span>
        <Input
          type="text"
          value={filters.origin}
          onChange={(event) => onChange({ origin: event.target.value })}
          placeholder="Origen"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Hacia</span>
        <Input
          type="text"
          value={filters.destination}
          onChange={(event) => onChange({ destination: event.target.value })}
          placeholder="Destino"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-semibold uppercase tracking-wide text-base-content/60">Tipo</span>
        <Input
          as="select"
          value={filters.direction}
          onChange={(event) => onChange({ direction: event.target.value as Filters["direction"] })}
        >
          <option value="">Todos</option>
          <option value="IN">Ingreso</option>
          <option value="OUT">Egreso</option>
          <option value="NEUTRO">Neutro</option>
        </Input>
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Filtrando..." : "Aplicar filtros"}
        </Button>
      </div>
    </form>
  );
}
