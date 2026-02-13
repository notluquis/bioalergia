import { Description, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { today } from "@/lib/dates";
import { currencyFormatter } from "@/lib/format";

import type { ServiceSchedule, ServiceSummary } from "../types";

interface AgendaGroup {
  dateKey: string;
  entries: { schedule: ServiceSchedule; service: ServiceSummary }[];
  label: string;
  total: number;
}

interface ServicesUnifiedAgendaProps {
  canManage: boolean;
  error?: null | string;
  items: { schedule: ServiceSchedule; service: ServiceSummary }[];
  loading?: boolean;
  onRegisterPayment: (serviceId: string, schedule: ServiceSchedule) => void;
  onUnlinkPayment: (serviceId: string, schedule: ServiceSchedule) => void;
}

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  weekday: "long",
});

function computeLabel(dueDate: dayjs.Dayjs) {
  const today = dayjs().startOf("day");
  const diff = dueDate.startOf("day").diff(today, "day");
  if (diff === 0) {
    return "Hoy";
  }
  if (diff === 1) {
    return "Mañana";
  }
  if (diff === -1) {
    return "Ayer";
  }
  if (diff > 1 && diff <= 7) {
    return `En ${diff} días`;
  }
  if (diff < -1 && diff >= -7) {
    return `Hace ${Math.abs(diff)} días`;
  }
  return capitalize(dateFormatter.format(dueDate.toDate()));
}

const statusClasses: Record<ServiceSchedule["status"], string> = {
  PAID: "bg-success/20 text-success",
  PARTIAL: "bg-warning/20 text-warning",
  PENDING: "bg-warning/20 text-warning",
  SKIPPED: "bg-default-50 text-default-500",
};
export function ServicesUnifiedAgenda({
  canManage,
  error,
  items,
  loading,
  onRegisterPayment,
  onUnlinkPayment,
}: ServicesUnifiedAgendaProps) {
  const skeletons = Array.from({ length: 4 }, (_, index) => index);
  const groups = (() => {
    if (items.length === 0) {
      return [];
    }
    const map = new Map<string, AgendaGroup>();
    for (const { schedule, service } of items) {
      const dueDate = dayjs(schedule.due_date).startOf("day");
      const key = dueDate.format("YYYY-MM-DD");
      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          entries: [],
          label: computeLabel(dueDate),
          total: 0,
        });
      }
      // biome-ignore lint/style/noNonNullAssertion: map key set above
      const group = map.get(key)!;
      group.total += schedule.expected_amount;
      group.entries.push({ schedule, service });
    }
    return [...map.values()].toSorted((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  })();

  const totals = (() => {
    const today = dayjs().startOf("day");
    let daySum = 0;
    let weekSum = 0;
    let monthSum = 0;
    for (const { schedule } of items) {
      const dueDate = dayjs(schedule.due_date).startOf("day");
      if (dueDate.isSame(today, "day")) {
        daySum += schedule.expected_amount;
      }
      if (dueDate.isSame(today, "week")) {
        weekSum += schedule.expected_amount;
      }
      if (dueDate.isSame(today, "month")) {
        monthSum += schedule.expected_amount;
      }
    }
    return {
      day: daySum,
      month: monthSum,
      week: weekSum,
    };
  })();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const todayKey = today();
    return groups.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.dateKey] = group.dateKey === todayKey;
      return acc;
    }, {});
  });

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section className="space-y-4">
      <header className="surface-muted grid gap-4 p-4 text-default-600 text-sm sm:grid-cols-3">
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Pagos hoy
          </Description>
          <span className="block font-semibold text-foreground text-xl">
            {currencyFormatter.format(totals.day)}
          </span>
        </div>
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Semana en curso
          </Description>
          <span className="block font-semibold text-foreground text-xl">
            {currencyFormatter.format(totals.week)}
          </span>
        </div>
        <div>
          <Description className="text-default-400 text-xs uppercase tracking-wide">
            Mes en curso
          </Description>
          <span className="block font-semibold text-foreground text-xl">
            {currencyFormatter.format(totals.month)}
          </span>
        </div>
      </header>

      <div className="surface-recessed space-y-3 p-4 text-default-600 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-default-400 text-sm uppercase tracking-wide">
              Agenda unificada
            </span>
            <Description className="text-default-300 text-xs">
              Visualiza todos los pagos programados por fecha de vencimiento.
            </Description>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-default-300 text-xs">
              <Spinner size="sm" />
              <span>Actualizando agenda…</span>
            </div>
          )}
        </div>
        {error && <Description className="text-danger text-xs">{error}</Description>}
        {groups.length === 0 && !loading && !error && (
          <Description className="text-default-300 text-xs">
            No hay cuotas programadas en el periodo consultado.
          </Description>
        )}
        {loading && groups.length === 0 && (
          <div className="space-y-2">
            {skeletons.map((value) => (
              <div
                className="rounded-2xl border border-default-200/60 bg-default-50/60 p-4 shadow-inner"
                key={value}
              >
                <div className="flex items-center justify-between">
                  <span className="skeleton-line w-24" />
                  <span className="skeleton-line w-16" />
                </div>
                <div className="mt-3 space-y-2">
                  <span className="skeleton-line block w-full" />
                  <span className="skeleton-line block w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="muted-scrollbar max-h-none space-y-2 pr-1 sm:max-h-128 sm:overflow-y-auto sm:overscroll-y-contain">
          {groups.map((group) => {
            const isExpanded = expanded[group.dateKey] ?? false;
            return (
              <article
                className="surface-muted transition hover:border-primary/35 hover:shadow-lg"
                key={group.dateKey}
              >
                <Button
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => {
                    toggle(group.dateKey);
                  }}
                  type="button"
                  variant="secondary"
                >
                  <div>
                    <span className="block font-semibold text-foreground text-sm capitalize">
                      {group.label}
                    </span>
                    <Description className="text-default-300 text-xs">
                      {group.entries.length} {group.entries.length === 1 ? "servicio" : "servicios"}
                    </Description>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground text-sm">
                      {currencyFormatter.format(group.total)}
                    </span>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-default-200 bg-background/70 font-semibold text-default-400 text-xs transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      ⌃
                    </span>
                  </div>
                </Button>
                {isExpanded && (
                  <div className="space-y-2 border-default-200/70 border-t px-4 py-3">
                    {group.entries.map(({ schedule, service }) => {
                      const dueDate = dayjs(schedule.due_date);
                      const diffDays = dueDate.startOf("day").diff(dayjs().startOf("day"), "day");
                      const isOverdue = schedule.status === "PENDING" && diffDays < 0;
                      return (
                        <div
                          className="surface-recessed p-3 transition hover:border-primary/40"
                          key={`${service.public_id}-${schedule.id}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="block font-semibold text-foreground text-sm">
                                {service.name}
                              </span>
                              {service.detail && (
                                <Description className="text-default-300 text-xs">
                                  {service.detail}
                                </Description>
                              )}
                              <Description className="mt-1 text-default-300 text-xs">
                                {currencyFormatter.format(schedule.expected_amount)} · Vence el{" "}
                                {dateFormatter.format(dueDate.toDate())}
                              </Description>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 font-semibold text-xs uppercase tracking-wide ${
                                statusClasses[schedule.status]
                              }`}
                            >
                              {schedule.status === "PENDING" && isOverdue
                                ? "Pendiente · Vencido"
                                : schedule.status}
                            </span>
                          </div>
                          {canManage && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              {(schedule.status === "PENDING" || schedule.status === "PARTIAL") && (
                                <Button
                                  onClick={() => {
                                    onRegisterPayment(service.public_id, schedule);
                                  }}
                                  size="sm"
                                >
                                  Registrar pago
                                </Button>
                              )}
                              {schedule.transaction_id && schedule.status === "PAID" && (
                                <Button
                                  onClick={() => {
                                    onUnlinkPayment(service.public_id, schedule);
                                  }}
                                  size="sm"
                                  variant="secondary"
                                >
                                  Desvincular pago
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function capitalize(value: string) {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}
