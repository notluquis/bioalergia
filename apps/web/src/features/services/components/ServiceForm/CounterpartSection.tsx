import type { ChangeEvent } from "react";

import Input from "@/components/ui/Input";
import { GRID_2_COL_MD } from "@/lib/styles";

import type { Counterpart, CounterpartAccount } from "../../../counterparts/types";
import type { ServiceFormState } from "../ServiceForm";

interface CounterpartSectionProps {
  accountReference?: null | string;
  accounts: CounterpartAccount[];
  accountsLoading: boolean;
  counterpartAccountId?: null | number;
  counterpartId?: null | number;
  counterparts: Counterpart[];
  counterpartsError: null | string;
  counterpartsLoading: boolean;
  onChange: <K extends keyof ServiceFormState>(key: K, value: ServiceFormState[K]) => void;
  onCounterpartSelect: (value: string) => void;
}

export function CounterpartSection({
  accountReference,
  accounts,
  accountsLoading,
  counterpartAccountId,
  counterpartId,
  counterparts,
  counterpartsError,
  counterpartsLoading,
  onChange,
  onCounterpartSelect,
}: CounterpartSectionProps) {
  let accountsHelper: string | undefined;
  if (counterpartsError) {
    accountsHelper = "No se pudo cargar las cuentas";
  } else if (counterpartsLoading) {
    accountsHelper = "Cargando opciones...";
  } else if (counterpartId && accounts.length === 0) {
    accountsHelper = "Esta contraparte aún no tiene cuentas agregadas";
  }

  return (
    <section className={GRID_2_COL_MD}>
      <Input
        as="select"
        disabled={counterpartsLoading}
        helper={counterpartsError ?? (counterpartsLoading ? "Cargando contrapartes..." : undefined)}
        label="Empresa / contraparte"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          onCounterpartSelect(event.target.value);
        }}
        value={counterpartId ? String(counterpartId) : ""}
      >
        <option value="">Sin contraparte</option>
        {counterparts.map((counterpart) => (
          <option key={counterpart.id} value={counterpart.id}>
            {counterpart.name}
          </option>
        ))}
      </Input>
      <Input
        as="select"
        disabled={!counterpartId || accountsLoading}
        helper={accountsHelper}
        label="Cuenta asociada"
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          onChange("counterpartAccountId", event.target.value ? Number(event.target.value) : null);
        }}
        value={counterpartAccountId ? String(counterpartAccountId) : ""}
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
        helper="Usa este campo si necesitas un alias o número distinto a las cuentas registradas"
        label="Referencia de cuenta"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange("accountReference", event.target.value);
        }}
        value={accountReference ?? ""}
      />
    </section>
  );
}
