import { CreditCard, Receipt } from "lucide-react";

import { MoneyInput } from "@/components/ui/MoneyInput";

import type { DailyBalanceFormData } from "../types";

interface EntryFormProps {
  values: DailyBalanceFormData;
  onChange: <K extends keyof DailyBalanceFormData>(field: K, value: DailyBalanceFormData[K]) => void;
  disabled?: boolean;
}

/**
 * Main entry form with Ingresos por método and Gastos sections
 * Uses existing MoneyInput component
 */
// Helper to convert number to string for MoneyInput
const toStr = (n: number) => (n === 0 ? "" : String(n));
const toNum = (s: string) => (s === "" ? 0 : Number(s));

export function EntryForm({ values, onChange, disabled = false }: EntryFormProps) {
  return (
    <div className="space-y-4">
      {/* Ingresos por método */}
      <section className="bg-base-200/30 border-base-content/5 rounded-2xl border p-4">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="text-base-content/60 size-5" />
          <h3 className="text-base font-semibold">Ingresos por método</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <MoneyInput
            icon={<span className="text-xs">💳</span>}
            label="Tarjetas"
            value={toStr(values.tarjeta)}
            onChange={(v) => onChange("tarjeta", toNum(v))}
            disabled={disabled}
          />
          <MoneyInput
            icon={<span className="text-xs">📲</span>}
            label="Transferencia"
            value={toStr(values.transferencia)}
            onChange={(v) => onChange("transferencia", toNum(v))}
            disabled={disabled}
          />
          <MoneyInput
            icon={<span className="text-xs">💵</span>}
            label="Efectivo"
            value={toStr(values.efectivo)}
            onChange={(v) => onChange("efectivo", toNum(v))}
            disabled={disabled}
          />
        </div>
      </section>

      {/* Gastos */}
      <section className="bg-base-200/30 border-base-content/5 rounded-2xl border p-4">
        <div className="mb-4 flex items-center gap-2">
          <Receipt className="text-base-content/60 size-5" />
          <h3 className="text-base font-semibold">Gastos</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyInput
            label="Gastos del día"
            value={toStr(values.gastos)}
            onChange={(v) => onChange("gastos", toNum(v))}
            disabled={disabled}
          />
          <div className="form-control">
            <label className="label py-1" htmlFor="input-nota">
              <span className="label-text text-xs font-medium sm:text-sm">Nota (opcional)</span>
            </label>
            <textarea
              id="input-nota"
              value={values.nota}
              onChange={(e) => onChange("nota", e.target.value)}
              disabled={disabled}
              placeholder="Detalles o comentarios..."
              rows={2}
              className="textarea textarea-bordered textarea-sm w-full resize-none"
            />
          </div>
        </div>
      </section>

      {/* Ingresos por servicio (optional detailed breakdown) */}
      <details className="group">
        <summary className="text-base-content/60 hover:text-base-content flex cursor-pointer items-center gap-2 px-1 py-2 text-sm">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Desglose por servicio (opcional)
        </summary>
        <section className="bg-base-200/30 border-base-content/5 mt-2 rounded-2xl border p-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <MoneyInput
              label="Consultas"
              value={toStr(values.consultas)}
              onChange={(v) => onChange("consultas", toNum(v))}
              disabled={disabled}
            />
            <MoneyInput
              label="Controles"
              value={toStr(values.controles)}
              onChange={(v) => onChange("controles", toNum(v))}
              disabled={disabled}
            />
            <MoneyInput
              label="Tests"
              value={toStr(values.tests)}
              onChange={(v) => onChange("tests", toNum(v))}
              disabled={disabled}
            />
            <MoneyInput
              label="Vacunas"
              value={toStr(values.vacunas)}
              onChange={(v) => onChange("vacunas", toNum(v))}
              disabled={disabled}
            />
            <MoneyInput
              label="Licencias"
              value={toStr(values.licencias)}
              onChange={(v) => onChange("licencias", toNum(v))}
              disabled={disabled}
            />
            <MoneyInput
              label="Roxair"
              value={toStr(values.roxair)}
              onChange={(v) => onChange("roxair", toNum(v))}
              disabled={disabled}
            />
            <MoneyInput
              label="Otros"
              value={toStr(values.otros)}
              onChange={(v) => onChange("otros", toNum(v))}
              disabled={disabled}
            />
          </div>
        </section>
      </details>
    </div>
  );
}
