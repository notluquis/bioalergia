import { Label, NumberField, TextArea } from "@heroui/react";
import { CreditCard, Receipt } from "lucide-react";
import type { ReactNode } from "react";

import type { DailyBalanceFormData } from "../types";

interface EntryFormProps {
  disabled?: boolean;
  onChange: <K extends keyof DailyBalanceFormData>(
    field: K,
    value: DailyBalanceFormData[K],
  ) => void;
  values: DailyBalanceFormData;
}

function CurrencyInput({
  disabled,
  icon,
  label,
  onValueChange,
  value,
}: Readonly<{
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onValueChange: (next: number | null) => void;
  value: number;
}>) {
  return (
    <NumberField
      formatOptions={{
        currency: "CLP",
        currencyDisplay: "symbol",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
        style: "currency",
      }}
      isDisabled={disabled}
      onChange={(next) => onValueChange(next ?? null)}
      value={value}
    >
      <Label className="flex items-center gap-1.5 font-medium text-xs sm:text-sm">
        {icon}
        {label}
      </Label>
      <NumberField.Group>
        <NumberField.Input />
      </NumberField.Group>
    </NumberField>
  );
}

/**
 * Main entry form with Ingresos por método and Gastos sections
 * Uses existing MoneyInput component
 */
export function EntryForm({ disabled = false, onChange, values }: EntryFormProps) {
  return (
    <div className="space-y-4">
      {/* Ingresos por método */}
      <section className="rounded-2xl border border-default-100 bg-default-50/30 p-4">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="size-5 text-default-500" />
          <h3 className="font-semibold text-base">Ingresos por método</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <CurrencyInput
            disabled={disabled}
            icon={<span className="text-xs">💳</span>}
            label="Tarjetas"
            onValueChange={(v) => {
              onChange("tarjeta", v || 0);
            }}
            value={values.tarjeta}
          />
          <CurrencyInput
            disabled={disabled}
            icon={<span className="text-xs">📲</span>}
            label="Transferencia"
            onValueChange={(v) => {
              onChange("transferencia", v || 0);
            }}
            value={values.transferencia}
          />
          <CurrencyInput
            disabled={disabled}
            icon={<span className="text-xs">💵</span>}
            label="Efectivo"
            onValueChange={(v) => {
              onChange("efectivo", v || 0);
            }}
            value={values.efectivo}
          />
        </div>
      </section>

      {/* Gastos */}
      <section className="rounded-2xl border border-default-100 bg-default-50/30 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="size-5 text-default-500" />
          <h3 className="font-semibold text-base">Gastos</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CurrencyInput
            disabled={disabled}
            label="Gastos del día"
            onValueChange={(v) => {
              onChange("gastos", v || 0);
            }}
            value={values.gastos}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="font-medium text-xs sm:text-sm" htmlFor="input-nota">
              Nota (opcional)
            </Label>
            <TextArea
              className="w-full resize-none"
              disabled={disabled}
              id="input-nota"
              onChange={(e) => {
                onChange("nota", e.target.value);
              }}
              placeholder="Detalles o comentarios..."
              rows={2}
              value={values.nota}
              variant="secondary"
            />
          </div>
        </div>
      </section>

      {/* Ingresos por servicio (desglose) */}
      <section className="mt-4 rounded-2xl border border-default-100 bg-default-50/30 p-4">
        <h3 className="mb-4 font-semibold text-base">Desglose por servicio</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <CurrencyInput
            disabled={disabled}
            label="Consultas"
            onValueChange={(v) => {
              onChange("consultas", v || 0);
            }}
            value={values.consultas}
          />
          <CurrencyInput
            disabled={disabled}
            label="Controles"
            onValueChange={(v) => {
              onChange("controles", v || 0);
            }}
            value={values.controles}
          />
          <CurrencyInput
            disabled={disabled}
            label="Tests"
            onValueChange={(v) => {
              onChange("tests", v || 0);
            }}
            value={values.tests}
          />
          <CurrencyInput
            disabled={disabled}
            label="Vacunas"
            onValueChange={(v) => {
              onChange("vacunas", v || 0);
            }}
            value={values.vacunas}
          />
          <CurrencyInput
            disabled={disabled}
            label="Licencias"
            onValueChange={(v) => {
              onChange("licencias", v || 0);
            }}
            value={values.licencias}
          />
          <CurrencyInput
            disabled={disabled}
            label="Roxair"
            onValueChange={(v) => {
              onChange("roxair", v || 0);
            }}
            value={values.roxair}
          />
          <CurrencyInput
            disabled={disabled}
            label="Otros"
            onValueChange={(v) => {
              onChange("otros", v || 0);
            }}
            value={values.otros}
          />
        </div>
      </section>
    </div>
  );
}
