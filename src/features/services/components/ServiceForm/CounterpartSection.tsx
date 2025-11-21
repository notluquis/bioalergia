import type { ChangeEvent } from "react";
import Input from "../../../../components/ui/Input";
import type { Counterpart, CounterpartAccount } from "../../../counterparts/types";
import type { ServiceFormState } from "../ServiceForm";

interface CounterpartSectionProps {
  counterpartId?: number | null;
  counterpartAccountId?: number | null;
  accountReference?: string | null;
  counterparts: Counterpart[];
  accounts: CounterpartAccount[];
  counterpartsLoading: boolean;
  accountsLoading: boolean;
  counterpartsError: string | null;
  onCounterpartSelect: (value: string) => void;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
}

export function CounterpartSection({
  counterpartId,
  counterpartAccountId,
  accountReference,
  counterparts,
  accounts,
  counterpartsLoading,
  accountsLoading,
  counterpartsError,
  onCounterpartSelect,
  onChange,
}: CounterpartSectionProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      <Input
        label="Empresa / contraparte"
        as="select"
        value={counterpartId ? String(counterpartId) : ""}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onCounterpartSelect(event.target.value)}
        disabled={counterpartsLoading}
        helper={counterpartsError ?? (counterpartsLoading ? "Cargando contrapartes..." : undefined)}
      >
        <option value="">Sin contraparte</option>
        {counterparts.map((counterpart) => (
          <option key={counterpart.id} value={counterpart.id}>
            {counterpart.name}
          </option>
        ))}
      </Input>
      <Input
        label="Cuenta asociada"
        as="select"
        value={counterpartAccountId ? String(counterpartAccountId) : ""}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange("counterpartAccountId", event.target.value ? Number(event.target.value) : null)
        }
        disabled={!counterpartId || accountsLoading}
        helper={
          counterpartsError
            ? "No se pudo cargar las cuentas"
            : counterpartsLoading
              ? "Cargando opciones..."
              : counterpartId && !accounts.length
                ? "Esta contraparte aún no tiene cuentas agregadas"
                : undefined
        }
      >
        <option value="">Sin cuenta específica</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.account_identifier}
            {account.bank_name ? ` · ${account.bank_name}` : ""}
          </option>
        ))}
      </Input>
      <Input
        label="Referencia de cuenta"
        value={accountReference ?? ""}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange("accountReference", event.target.value)}
        helper="Usa este campo si necesitas un alias o número distinto a las cuentas registradas"
      />
    </section>
  );
}
