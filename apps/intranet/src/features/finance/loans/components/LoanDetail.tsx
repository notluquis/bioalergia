import { Description } from "@heroui/react";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select, SelectItem } from "@/components/ui/Select";

import type { LoanSchedule, LoanSummary, RegenerateSchedulePayload } from "../types";

import { LoanScheduleTable } from "./LoanScheduleTable";

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
    if (!loan) {
      return { className: "", label: "" };
    }
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

  const handleRegenerate = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!loan) {
      return;
    }
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
      <section className="flex h-full flex-col items-center justify-center rounded-3xl bg-background p-10 text-default-500 text-sm">
        <Description>Selecciona un préstamo para ver el detalle.</Description>
      </section>
    );
  }

  return (
    <section className="relative flex h-full flex-col gap-6 rounded-3xl bg-background p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <span className="block font-bold text-2xl text-primary drop-shadow-sm">{loan.title}</span>
          <Description className="text-foreground/90 text-sm">
            {loan.borrower_name} · {loan.borrower_type === "PERSON" ? "Persona natural" : "Empresa"}
          </Description>
          <div className="flex flex-wrap items-center gap-3 text-default-500 text-xs">
            <span>Inicio {dayjs(loan.start_date, "YYYY-MM-DD").format("DD MMM YYYY")}</span>
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
            className={`rounded-full px-3 py-1 font-semibold text-xs uppercase tracking-wide ${statusBadge.className}`}
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

      <section className="grid gap-4 rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm sm:grid-cols-4">
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Capital
          </Description>
          <span className="block font-semibold text-foreground text-lg">
            ${loan.principal_amount.toLocaleString("es-CL")}
          </span>
        </div>
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Total esperado
          </Description>
          <span className="block font-semibold text-foreground text-lg">
            ${(summary?.total_expected ?? 0).toLocaleString("es-CL")}
          </span>
        </div>
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Pagado
          </Description>
          <span className="block font-semibold text-lg text-success">
            ${(summary?.total_paid ?? 0).toLocaleString("es-CL")}
          </span>
        </div>
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Saldo
          </Description>
          <span className="block font-semibold text-danger text-lg">
            ${(summary?.remaining_amount ?? 0).toLocaleString("es-CL")}
          </span>
        </div>
      </section>

      <LoanScheduleTable
        canManage={canManage}
        onRegisterPayment={onRegisterPayment}
        onUnlinkPayment={onUnlinkPayment}
        schedules={schedules}
      />

      {loan.notes && (
        <div className="rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm">
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Notas
          </Description>
          <Description>{loan.notes}</Description>
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
              setRegenerateForm((prev) => ({
                ...prev,
                totalInstallments: Number(event.target.value),
              }));
            }}
            type="number"
            value={regenerateForm.totalInstallments ?? loan.total_installments}
          />

          <Input
            label="Nueva fecha de inicio"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setRegenerateForm((prev) => ({
                ...prev,
                startDate: event.target.value,
              }));
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

          <Select
            label="Frecuencia"
            onChange={(key) => {
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: key as RegenerateSchedulePayload["frequency"],
              }));
            }}
            value={regenerateForm.frequency ?? loan.frequency}
          >
            <SelectItem key="WEEKLY">Semanal</SelectItem>
            <SelectItem key="BIWEEKLY">Quincenal</SelectItem>
            <SelectItem key="MONTHLY">Mensual</SelectItem>
          </Select>
          {regenerateError && (
            <Description className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
              {regenerateError}
            </Description>
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
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <Description className="rounded-full bg-background px-4 py-2 font-semibold text-primary text-sm shadow">
            Cargando préstamo...
          </Description>
        </div>
      )}
    </section>
  );
}
