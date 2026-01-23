import { CreditCard, Receipt } from "lucide-react";

import { MoneyInput } from "@/components/ui/MoneyInput";

import type { DailyBalanceFormData } from "../types";

interface EntryFormProps {
  disabled?: boolean;
  onChange: <K extends keyof DailyBalanceFormData>(
    field: K,
    value: DailyBalanceFormData[K],
  ) => void;
  values: DailyBalanceFormData;
}

/**
 * Main entry form with Ingresos por método and Gastos sections
 * Uses existing MoneyInput component
 */
// Helper to convert number to string for MoneyInput
const toStr = (n: number) => (n === 0 ? "" : String(n));
const toNum = (s: string) => (s === "" ? 0 : Number(s));

export function EntryForm({ disabled = false, onChange, values }: EntryFormProps) {
  return (
    <div className="space-y-4">
      {/* Ingresos por método */}
      <section className="bg-default-50/30 border-default-100 rounded-2xl border p-4">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="text-default-500 size-5" />
          <h3 className="text-base font-semibold">Ingresos por método</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyInput
            disabled={disabled}
            icon={<span className="text-xs">💳</span>}
            label="Tarjetas"
            onChange={(v) => {
              onChange("tarjeta", toNum(v));
            }}
            value={toStr(values.tarjeta)}
          />
          <MoneyInput
            disabled={disabled}
            icon={<span className="text-xs">📲</span>}
            label="Transferencia"
            onChange={(v) => {
              onChange("transferencia", toNum(v));
            }}
            value={toStr(values.transferencia)}
          />
          <MoneyInput
            disabled={disabled}
            icon={<span className="text-xs">💵</span>}
            label="Efectivo"
            onChange={(v) => {
              onChange("efectivo", toNum(v));
            }}
            value={toStr(values.efectivo)}
          />
        </div>
      </section>

      {/* Gastos */}
      <section className="bg-default-50/30 border-default-100 rounded-2xl border p-4">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="text-default-500 size-5" />
          <h3 className="text-base font-semibold">Gastos</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput
            disabled={disabled}
            label="Gastos del día"
            onChange={(v) => {
              onChange("gastos", toNum(v));
            }}
            value={toStr(values.gastos)}
          />
          <div className="form-control">
            <label className="label py-1" htmlFor="input-nota">
              <span className="label-text text-xs font-medium sm:text-sm">Nota (opcional)</span>
            </label>
            <textarea
              className="textarea textarea-bordered textarea-sm w-full resize-none"
              disabled={disabled}
              id="input-nota"
              onChange={(e) => {
                onChange("nota", e.target.value);
              }}
              placeholder="Detalles o comentarios..."
              rows={2}
              value={values.nota}
            />
          </div>
        </div>
      </section>

      {/* Ingresos por servicio (desglose) */}
      <section className="bg-default-50/30 border-default-100 mt-4 rounded-2xl border p-4">
        <h3 className="mb-4 text-base font-semibold">Desglose por servicio</h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <MoneyInput
            disabled={disabled}
            label="Consultas"
            onChange={(v) => {
              onChange("consultas", toNum(v));
            }}
            value={toStr(values.consultas)}
          />
          <MoneyInput
            disabled={disabled}
            label="Controles"
            onChange={(v) => {
              onChange("controles", toNum(v));
            }}
            value={toStr(values.controles)}
          />
          <MoneyInput
            disabled={disabled}
            label="Tests"
            onChange={(v) => {
              onChange("tests", toNum(v));
            }}
            value={toStr(values.tests)}
          />
          <MoneyInput
            disabled={disabled}
            label="Vacunas"
            onChange={(v) => {
              onChange("vacunas", toNum(v));
            }}
            value={toStr(values.vacunas)}
          />
          <MoneyInput
            disabled={disabled}
            label="Licencias"
            onChange={(v) => {
              onChange("licencias", toNum(v));
            }}
            value={toStr(values.licencias)}
          />
          <MoneyInput
            disabled={disabled}
            label="Roxair"
            onChange={(v) => {
              onChange("roxair", toNum(v));
            }}
            value={toStr(values.roxair)}
          />
          <MoneyInput
            disabled={disabled}
            label="Otros"
            onChange={(v) => {
              onChange("otros", toNum(v));
            }}
            value={toStr(values.otros)}
          />
        </div>
      </section>
    </div>
  );
}
