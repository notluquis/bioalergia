import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/Input";
import { Select, SelectItem } from "@/components/ui/Select";
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
      <Select
        isDisabled={counterpartsLoading}
        helper={counterpartsError ?? (counterpartsLoading ? "Cargando contrapartes..." : undefined)}
        label="Empresa / contraparte"
        onChange={(val) => onCounterpartSelect(val as string)}
        value={counterpartId ? String(counterpartId) : ""}
      >
        <SelectItem key="">Sin contraparte</SelectItem>
        {counterparts.map((counterpart) => (
          <SelectItem key={counterpart.id}>{counterpart.bankAccountHolder}</SelectItem>
        ))}
      </Select>
      <Select
        isDisabled={!counterpartId || accountsLoading}
        helper={accountsHelper}
        label="Cuenta asociada"
        onChange={(val) => {
          onChange("counterpartAccountId", val ? Number(val) : null);
        }}
        value={counterpartAccountId ? String(counterpartAccountId) : ""}
      >
        <SelectItem key="">Sin cuenta específica</SelectItem>
        {accounts.map((account) => (
          <SelectItem key={account.id}>
            {account.accountNumber}
            {account.bankName ? ` · ${account.bankName}` : ""}
          </SelectItem>
        ))}
      </Select>
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
