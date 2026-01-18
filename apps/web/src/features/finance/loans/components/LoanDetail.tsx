import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

import type { LoanSchedule, LoanSummary, RegenerateSchedulePayload } from "../types";

import LoanScheduleTable from "./LoanScheduleTable";

interface LoanDetailProps {
  canManage: boolean;
  loading: boolean;
  loan: LoanSummary | null;
  onRegenerate: (payload: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  schedules: LoanSchedule[];
  summary: null | {
    paid_installments: number;
    pending_installments: number;
    remaining_amount: number;
    total_expected: number;
    total_paid: number;
  };
}

export function LoanDetail({
  canManage,
  loading,
  loan,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
  summary,
}: LoanDetailProps) {
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateForm, setRegenerateForm] = useState<RegenerateSchedulePayload>({});
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<null | string>(null);

  const statusBadge = (() => {
    if (!loan) return { className: "", label: "" };
    switch (loan.status) {
      case "COMPLETED": {
        return { className: "bg-emerald-100 text-emerald-700", label: "Liquidado" };
      }
      case "DEFAULTED": {
        return { className: "bg-rose-100 text-rose-700", label: "En mora" };
      }
      default: {
        return { className: "bg-amber-100 text-amber-700", label: "Activo" };
      }
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo regenerar el cronograma";
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
              {
                {
                  BIWEEKLY: "quincenal",
                  MONTHLY: "mensual",
                  WEEKLY: "semanal",
                }[loan.frequency]
              }
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
            <Button
              onClick={() => {
                setRegenerateOpen(true);
              }}
              type="button"
              variant="secondary"
            >
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
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        schedules={schedules}
      />

      {loan.notes && (
        <div className="border-base-300 bg-base-200 text-base-content rounded-2xl border p-4 text-sm">
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Notas</p>
          <p>{loan.notes}</p>
        </div>
      )}

      <Modal
        isOpen={regenerateOpen}
        onClose={() => {
          setRegenerateOpen(false);
        }}
        title="Regenerar cronograma"
      >
        <form className="space-y-4" onSubmit={handleRegenerate}>
          <Input
            label="Nuevo total de cuotas"
            max={360}
            min={1}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({ ...prev, totalInstallments: Number(event.target.value) }));
            }}
            type="number"
            value={regenerateForm.totalInstallments ?? loan.total_installments}
          />
          <Input
            label="Nueva fecha de inicio"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({ ...prev, startDate: event.target.value }));
            }}
            type="date"
            value={regenerateForm.startDate ?? loan.start_date}
          />
          <Input
            label="Tasa de interés (%)"
            min={0}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({ ...prev, interestRate: Number(event.target.value) }));
            }}
            step="0.01"
            type="number"
            value={regenerateForm.interestRate ?? loan.interest_rate}
          />
          <Input
            as="select"
            label="Frecuencia"
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: event.target.value as RegenerateSchedulePayload["frequency"],
              }));
            }}
            value={regenerateForm.frequency ?? loan.frequency}
          >
            <option value="WEEKLY">Semanal</option>
            <option value="BIWEEKLY">Quincenal</option>
            <option value="MONTHLY">Mensual</option>
          </Input>
          {regenerateError && (
            <p className="rounded-lg bg-rose-100 px-4 py-2 text-sm text-rose-700">{regenerateError}</p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              disabled={regenerating}
              onClick={() => {
                setRegenerateOpen(false);
              }}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button disabled={regenerating} type="submit">
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
