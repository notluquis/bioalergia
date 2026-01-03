import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

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
      className="text-base-content bg-base-100 grid gap-4 p-6 text-xs lg:grid-cols-4"
    >
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Fecha desde</span>
        <Input type="date" value={filters.from} onChange={(event) => onChange({ from: event.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Fecha hasta</span>
        <Input type="date" value={filters.to} onChange={(event) => onChange({ to: event.target.value })} />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Descripción</span>
        <Input
          type="text"
          value={filters.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Contiene..."
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Source ID</span>
        <Input
          type="text"
          value={filters.sourceId}
          onChange={(event) => onChange({ sourceId: event.target.value })}
          placeholder="SOURCE_ID"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Ref. Externa</span>
        <Input
          type="text"
          value={filters.externalReference}
          onChange={(event) => onChange({ externalReference: event.target.value })}
          placeholder="Referencia externa"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Tipo Transacción</span>
        <Input
          type="text"
          value={filters.transactionType}
          onChange={(event) => onChange({ transactionType: event.target.value })}
          placeholder="Ej: payment, release"
          enterKeyHint="search"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-base-content/60 font-semibold tracking-wide uppercase">Estado</span>
        <Input
          type="text"
          value={filters.status}
          onChange={(event) => onChange({ status: event.target.value })}
          placeholder="Ej: approved"
          enterKeyHint="search"
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={loading} size="sm">
          {loading ? "Filtrando..." : "Aplicar filtros"}
        </Button>
      </div>
    </form>
  );
}
