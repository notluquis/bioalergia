import { formatChile } from "@/lib/dates";
import {
  Button,
  Calendar,
  Card,
  Chip,
  DateField,
  DatePicker,
  Description,
  Label,
  ListBox,
  NumberField,
  Select,
  Spinner,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useState } from "react";

import { AppModal } from "@/components/ui/AppModal";

import type { LoanSchedule, LoanSource, LoanSummary, RegenerateSchedulePayload } from "../types";

import { LoanScheduleTable } from "./LoanScheduleTable";

interface LoanDetailProps {
  canDelete: boolean;
  canManage: boolean;
  loading: boolean;
  loan: LoanSummary | null;
  onDeleteRequest: (loan: LoanSummary) => void;
  onEditRequest: (loan: LoanSummary) => void;
  onEditSchedule: (schedule: LoanSchedule) => void;
  onRegenerate: (payload: RegenerateSchedulePayload) => Promise<void>;
  onRegisterPayment: (schedule: LoanSchedule) => void;
  onUnlinkPayment: (schedule: LoanSchedule) => void;
  schedules: LoanSchedule[];
  sources?: LoanSource[];
  summary: null | {
    paid_installments: number;
    pending_installments: number;
    remaining_amount: number;
    total_expected: number;
    total_paid: number;
  };
}

function MetricCard({
  label,
  tone = "default",
  value,
}: {
  label: string;
  tone?: "danger" | "default" | "success";
  value: string;
}) {
  const toneClassName = {
    danger: "text-danger",
    default: "text-foreground",
    success: "text-success",
  }[tone];

  return (
    <div className="rounded-md border border-default-200 bg-default-50 px-3 py-2">
      <Description className="text-default-500 text-xs">{label}</Description>
      <span className={`block font-semibold text-base tabular-nums ${toneClassName}`}>{value}</span>
    </div>
  );
}

export function LoanDetail({
  canManage,
  canDelete,
  loading,
  loan,
  onDeleteRequest,
  onEditRequest,
  onEditSchedule,
  onRegenerate,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
  sources = [],
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
      <Card className="flex h-full flex-col items-center justify-center border-default-200 bg-background p-10 text-default-500 text-sm shadow-sm">
        <Card.Title className="text-base text-foreground">Sin préstamo seleccionado</Card.Title>
        <Card.Description>Selecciona un préstamo para ver el detalle.</Card.Description>
      </Card>
    );
  }

  const beneficiaryName = loan.counterpart?.bankAccountHolder ?? loan.borrower_name;
  const beneficiaryDetail = loan.counterpart
    ? `Contraparte ${loan.counterpart.identificationNumber}`
    : loan.borrower_type === "PERSON"
      ? "Persona natural"
      : "Empresa";

  return (
    <Card className="relative flex h-full min-h-0 flex-col overflow-hidden border-default-200 bg-background shadow-sm">
      <Card.Header className="items-start gap-4 border-default-200 border-b px-5 py-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Card.Title className="text-xl text-primary">{loan.title}</Card.Title>
                <Chip className={statusBadge.className} size="sm" variant="soft">
                  {statusBadge.label}
                </Chip>
              </div>
              <Card.Description className="text-foreground/90 text-sm">
                {beneficiaryName} · {beneficiaryDetail}
              </Card.Description>
              <div className="flex flex-wrap items-center gap-2">
                <Chip size="sm" variant="soft">
                  Inicio {formatChile(loan.start_date, "DD MMM YYYY")}
                </Chip>
                <Chip size="sm" variant="soft">
                  {loan.total_installments} cuotas ·{" "}
                  {
                    {
                      BIWEEKLY: "quincenal",
                      IRREGULAR: "irregular",
                      MONTHLY: "mensual",
                      WEEKLY: "semanal",
                    }[loan.frequency]
                  }
                </Chip>
                <Chip size="sm" variant="soft">
                  Tasa {loan.interest_rate.toLocaleString("es-CL")}%
                </Chip>
              </div>
            </div>
            {(canManage || canDelete) && (
              <div className="flex shrink-0 flex-wrap gap-2">
                {canManage && (
                  <>
                    <Button
                      onPress={() => {
                        onEditRequest(loan);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Editar
                    </Button>
                    <Button
                      onPress={() => {
                        setRegenerateOpen(true);
                      }}
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      Regenerar cronograma
                    </Button>
                  </>
                )}
                {canDelete && (
                  <Button
                    onPress={() => {
                      onDeleteRequest(loan);
                    }}
                    size="sm"
                    type="button"
                    variant="danger"
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Card.Header>

      <Card.Content className="muted-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Capital" value={`$${loan.principal_amount.toLocaleString("es-CL")}`} />
          <MetricCard
            label="Total esperado"
            value={`$${(summary?.total_expected ?? 0).toLocaleString("es-CL")}`}
          />
          <MetricCard
            label="Pagado"
            tone="success"
            value={`$${(summary?.total_paid ?? 0).toLocaleString("es-CL")}`}
          />
          <MetricCard
            label="Saldo"
            tone="danger"
            value={`$${(summary?.remaining_amount ?? 0).toLocaleString("es-CL")}`}
          />
        </section>

        {sources.length > 0 && (
          <section className="border-default-200 border-t pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground text-sm">Origen del préstamo</h3>
                <p className="text-default-500 text-xs">
                  Fuentes que componen el capital y sus cargos.
                </p>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {sources.map((source) => (
                <div
                  className="space-y-2 rounded-lg border border-default-200 bg-default-50 px-3 py-2"
                  key={source.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{source.label}</span>
                    <Chip size="sm" variant="soft">
                      {source.source_type}
                    </Chip>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-default-500 text-xs">
                    <span>Capital ${source.principal_amount.toLocaleString("es-CL")}</span>
                    <span>Interés {source.fixed_interest_rate.toLocaleString("es-CL")}%</span>
                    <span>Total ${source.total_amount.toLocaleString("es-CL")}</span>
                  </div>
                  {source.note && <Description className="mt-1 text-xs">{source.note}</Description>}
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="min-h-0 border-default-200 border-t pt-4">
          <div className="mb-3">
            <h3 className="font-semibold text-foreground text-sm">Cronograma de cuotas</h3>
            <p className="text-default-500 text-xs">
              {summary
                ? `${summary.paid_installments} pagadas · ${summary.pending_installments} pendientes`
                : "Cuotas registradas del préstamo"}
            </p>
          </div>
          <LoanScheduleTable
            canManage={canManage}
            onEditSchedule={onEditSchedule}
            onRegisterPayment={onRegisterPayment}
            onUnlinkPayment={onUnlinkPayment}
            schedules={schedules}
          />
        </section>

        {loan.notes && (
          <section className="border-default-200 border-t pt-4">
            <h3 className="mb-2 font-semibold text-foreground text-sm">Notas</h3>
            <Description>{loan.notes}</Description>
          </section>
        )}
      </Card.Content>

      <AppModal
        isOpen={regenerateOpen}
        onClose={() => {
          setRegenerateOpen(false);
        }}
        title="Regenerar cronograma"
        size="lg"
        footer={
          <>
            <Button
              isDisabled={regenerating}
              onPress={() => {
                setRegenerateOpen(false);
              }}
              type="button"
              variant="secondary"
            >
              Cancelar
            </Button>
            <Button isDisabled={regenerating} type="submit" form="regenerate-schedule-form">
              {regenerating ? "Actualizando..." : "Regenerar"}
            </Button>
          </>
        }
      >
        <form
          id="regenerate-schedule-form"
          className="space-y-4"
          onSubmit={(e) => {
            void handleRegenerate(e);
          }}
        >
          <NumberField
            maxValue={360}
            minValue={1}
            onChange={(value) => {
              setRegenerateForm((prev) => ({
                ...prev,
                totalInstallments: value,
              }));
            }}
            value={regenerateForm.totalInstallments ?? loan.total_installments}
          >
            <Label>Nuevo total de cuotas</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>

          <DatePicker
            onChange={(value) => {
              setRegenerateForm((prev) => ({
                ...prev,
                startDate: value?.toString() ?? "",
              }));
            }}
            value={parseDate(regenerateForm.startDate ?? loan.start_date)}
          >
            <Label>Nueva fecha de inicio</Label>
            <DateField.Group>
              <DateField.InputContainer>
                <DateField.Input>
                  {(segment) => <DateField.Segment segment={segment} />}
                </DateField.Input>
              </DateField.InputContainer>
              <DateField.Suffix>
                <DatePicker.Trigger>
                  <DatePicker.TriggerIndicator />
                </DatePicker.Trigger>
              </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover>
              <Calendar aria-label="Nueva fecha de inicio">
                <Calendar.Header>
                  <Calendar.YearPickerTrigger>
                    <Calendar.YearPickerTriggerHeading />
                    <Calendar.YearPickerTriggerIndicator />
                  </Calendar.YearPickerTrigger>
                  <Calendar.NavButton slot="previous" />
                  <Calendar.NavButton slot="next" />
                </Calendar.Header>
                <Calendar.Grid>
                  <Calendar.GridHeader>
                    {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                  </Calendar.GridHeader>
                  <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                </Calendar.Grid>
                <Calendar.YearPickerGrid>
                  <Calendar.YearPickerGridBody>
                    {({ year }) => <Calendar.YearPickerCell year={year} />}
                  </Calendar.YearPickerGridBody>
                </Calendar.YearPickerGrid>
              </Calendar>
            </DatePicker.Popover>
          </DatePicker>

          <NumberField
            minValue={0}
            step={0.01}
            formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
            onChange={(value) => {
              setRegenerateForm((prev) => ({
                ...prev,
                interestRate: value,
              }));
            }}
            value={regenerateForm.interestRate ?? loan.interest_rate}
          >
            <Label>Tasa de interés (%)</Label>
            <NumberField.Group className="grid-cols-1">
              <NumberField.Input />
            </NumberField.Group>
          </NumberField>

          <Select
            onChange={(key) => {
              setRegenerateForm((prev) => ({
                ...prev,
                frequency: key as RegenerateSchedulePayload["frequency"],
              }));
            }}
            value={
              regenerateForm.frequency ??
              // El ListBox solo ofrece W/BIW/M; un préstamo IRREGULAR no tiene
              // opción válida → default a MONTHLY para no dejar el Select vacío.
              (loan.frequency === "IRREGULAR" ? "MONTHLY" : loan.frequency)
            }
          >
            <Label>Frecuencia</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="WEEKLY">Semanal</ListBox.Item>
                <ListBox.Item id="BIWEEKLY">Quincenal</ListBox.Item>
                <ListBox.Item id="MONTHLY">Mensual</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
          {regenerateError && (
            <Description className="rounded-lg bg-rose-100 px-4 py-2 text-rose-700 text-sm">
              {regenerateError}
            </Description>
          )}
        </form>
      </AppModal>

      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/40 backdrop-blur-sm">
          <div className="flex items-center gap-2 rounded-full bg-background px-4 py-2 shadow">
            <Spinner size="sm" />
            <span className="font-semibold text-primary text-sm">Cargando préstamo...</span>
          </div>
        </div>
      )}
    </Card>
  );
}
