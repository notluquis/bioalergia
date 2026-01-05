import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

import type { LoanSchedule, LoanSummary, RegenerateSchedulePayload } from "../types";
import LoanScheduleTable from "./LoanScheduleTable";

interface LoanDetailProps {
  loan: LoanSummary | null;
  schedules: LoanSchedule[];
  summary: {
    total_expected: number;
    total_paid: number;
    remaining_amount: number;
    paid_installments: number;
    pending_installments: number;
  } | null;
  loading: boolean;
  canManage: boolean;
  onRegenerate: (payload: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
}

export function LoanDetail({
  loan,
  schedules,
  summary,
  loading,
  canManage,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
}: LoanDetailProps) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState<RegenerateSchedulePayload>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const statusBadge = (() => {
    if (!loan) return { label: "", className: "" };
    switch (loan.status) {
      case "COMPLETED":
        return { label: "Liquidado", className: "bg-emerald-100 text-emerald-700" };
      case "DEFAULTED":
        return { label: "En mora", className: "bg-rose-100 text-rose-700" };
      default:
        return { label: "Activo", className: "bg-amber-100 text-amber-700" };
    }
  })();

  const handleRegenerate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loan) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await onRegenerate(regenerateForm);
      setRegenerateOpen(false);
      setRegenerateForm({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo regenerar el cronograma";
      setRegenerateError(message);
    } finally {
      setRegenerating(false);
    }
  };

  if (!loan) {
    return (
      <section className="text-base-content/60 bg-base-100 flex h-full flex-col items-center justify-center rounded-3xl p-10 text-sm">
        <p>Selecciona un préstamo para ver el detalle.</p>
      </section>
    );
  }

  return (
    <section className="bg-base-100 relative flex h-full flex-col gap-6 rounded-3xl p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-primary text-2xl font-bold drop-shadow-sm">{loan.title}</h1>
          <p className="text-base-content/90 text-sm">
            {loan.borrower_name} · {loan.borrower_type === "PERSON" ? "Persona natural" : "Empresa"}
          </p>
          <div className="text-base-content/60 flex flex-wrap items-center gap-3 text-xs">
            <span>Inicio {dayjs(loan.start_date).format("DD MMM YYYY")}</span>
            <span>
              {loan.total_installments} cuotas ·{" "}
              {loan.frequency === "WEEKLY" ? "semanal" : loan.frequency === "BIWEEKLY" ? "quincenal" : "mensual"}
            </span>
            <span>Tasa {loan.interest_rate.toLocaleString("es-CL")}%</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          {canManage && (
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(true)}>
              Regenerar cronograma
            </Button>
          )}
        </div>
      </header>

      <section className="border-base-300 bg-base-200 text-base-content grid gap-4 rounded-2xl border p-4 text-sm sm:grid-cols-4">
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Capital</p>
          <p className="text-base-content text-lg font-semibold">${loan.principal_amount.toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Total esperado</p>
          <p className="text-base-content text-lg font-semibold">
            ${(summary?.total_expected ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Pagado</p>
          <p className="text-success text-lg font-semibold">${(summary?.total_paid ?? 0).toLocaleString("es-CL")}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Saldo</p>
          <p className="text-error text-lg font-semibold">
            ${(summary?.remaining_amount ?? 0).toLocaleString("es-CL")}
          </p>
        </div>
      </section>

      <LoanScheduleTable
        schedules={schedules}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        canManage={canManage}
      />

      {loan.notes && (
        <div className="border-base-300 bg-base-200 text-base-content rounded-2xl border p-4 text-sm">
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Notas</p>
          <p>{loan.notes}</p>
        </div>
      )}

      <Modal isOpen={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Regenerar cronograma">
        <form onSubmit={handleRegenerate} className="space-y-4">
          <Input
            label="Nuevo total de cuotas"
            type="number"
            value={regenerateForm.totalInstallments ?? loan.total_installments}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({ ...prev, totalInstallments: Number(event.target.value) }))
            }
            min={1}
            max={360}
          />
          <Input
            label="Nueva fecha de inicio"
            type="date"
            value={regenerateForm.startDate ?? loan.start_date}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({ ...prev, startDate: event.target.value }))
            }
          />
          <Input
            label="Tasa de interés (%)"
            type="number"
            value={regenerateForm.interestRate ?? loan.interest_rate}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setRegenerateForm((prev) => ({ ...prev, interestRate: Number(event.target.value) }))
            }
            min={0}
            step="0.01"
          />
          <Input
            label="Frecuencia"
            as="select"
            value={regenerateForm.frequency ?? loan.frequency}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: event.target.value as RegenerateSchedulePayload["frequency"],
              }))
            }
          >
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
          </Input>
          {regenerateError && (
            <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{regenerateError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setRegenerateOpen(false)} disabled={regenerating}>
              Cancelar
            </Button>
            <Button type="submit" disabled={regenerating}>
              {regenerating ? "Actualizando..." : "Regenerar"}
            </Button>
          </div>
        </form>
      </Modal>

      {loading && (
        <div className="bg-base-100/40 absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm">
          <p className="bg-base-100 text-primary rounded-full px-4 py-2 text-sm font-semibold shadow">
            Cargando préstamo...
          </p>
        </div>
      )}
    </section>
  );
}

export default LoanDetail;
