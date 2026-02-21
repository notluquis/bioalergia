import { Description, Label, ListBox, Select } from "@heroui/react";
import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/Input";
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
  const NO_COUNTERPART_KEY = "__no_counterpart__";
  const NO_ACCOUNT_KEY = "__no_counterpart_account__";

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
        onChange={(val) => onCounterpartSelect(val === NO_COUNTERPART_KEY ? "" : (val as string))}
        value={counterpartId ? String(counterpartId) : NO_COUNTERPART_KEY}
      >
        <Label>Empresa / contraparte</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id={NO_COUNTERPART_KEY} key={NO_COUNTERPART_KEY}>
              Sin contraparte
            </ListBox.Item>
            {counterparts.map((counterpart) => (
              <ListBox.Item id={String(counterpart.id)} key={counterpart.id}>
                {counterpart.bankAccountHolder}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {(counterpartsError || counterpartsLoading) && (
          <Description>{counterpartsError ?? "Cargando contrapartes..."}</Description>
        )}
      </Select>
      <Select
        isDisabled={!counterpartId || accountsLoading}
        onChange={(val) => {
          onChange("counterpartAccountId", val && val !== NO_ACCOUNT_KEY ? Number(val) : null);
        }}
        value={counterpartAccountId ? String(counterpartAccountId) : NO_ACCOUNT_KEY}
      >
        <Label>Cuenta asociada</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id={NO_ACCOUNT_KEY} key={NO_ACCOUNT_KEY}>
              Sin cuenta específica
            </ListBox.Item>
            {accounts.map((account) => (
              <ListBox.Item id={String(account.id)} key={account.id}>
                {account.accountNumber}
                {account.bankName ? ` · ${account.bankName}` : ""}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {accountsHelper && <Description>{accountsHelper}</Description>}
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
