import dayjs from "dayjs";
import { useState } from "react";

import Button from "@/components/ui/Button";
import { today } from "@/lib/dates";
import { currencyFormatter } from "@/lib/format";
import { LOADING_SPINNER_XS } from "@/lib/styles";

import type { ServiceSchedule, ServiceSummary } from "../types";

type ServicesUnifiedAgendaProps = {
  items: Array<{ service: ServiceSummary; schedule: ServiceSchedule }>;
  loading?: boolean;
  error?: string | null;
  canManage: boolean;
  onRegisterPayment: (serviceId: string, schedule: ServiceSchedule) => void;
  onUnlinkPayment: (serviceId: string, schedule: ServiceSchedule) => void;
};

type AgendaGroup = {
  dateKey: string;
  label: string;
  total: number;
  entries: Array<{ service: ServiceSummary; schedule: ServiceSchedule }>;
};

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "short",
});

function computeLabel(dueDate: dayjs.Dayjs) {
  const today = dayjs().startOf("day");
  const diff = dueDate.startOf("day").diff(today, "day");
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  if (diff > 1 && diff <= 7) return `En ${diff} días`;
  if (diff < -1 && diff >= -7) return `Hace ${Math.abs(diff)} días`;
  return capitalize(dateFormatter.format(dueDate.toDate()));
}

const statusClasses: Record<ServiceSchedule["status"], string> = {
  PENDING: "bg-warning/20 text-warning",
  PARTIAL: "bg-warning/20 text-warning",
  PAID: "bg-success/20 text-success",
  SKIPPED: "bg-base-200 text-base-content/60",
};

export default function ServicesUnifiedAgenda({
  items,
  loading,
  error,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServicesUnifiedAgendaProps) {
  const skeletons = Array.from({ length: 4 }, (_, index) => index);
  const groups = (() => {
    if (items.length === 0) return [];
    const map = new Map<string, AgendaGroup>();
    items.forEach(({ service, schedule }) => {
      const dueDate = dayjs(schedule.due_date).startOf("day");
      const key = dueDate.format("YYYY-MM-DD");
      if (!map.has(key)) {
        map.set(key, {
          dateKey: key,
          label: computeLabel(dueDate),
          total: 0,
          entries: [],
        });
      }
      const group = map.get(key)!;
      group.total += schedule.expected_amount;
      group.entries.push({ service, schedule });
    });
    return [...map.values()].toSorted((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  })();

  const totals = (() => {
    const today = dayjs().startOf("day");
    let daySum = 0;
    let weekSum = 0;
    let monthSum = 0;
    items.forEach(({ schedule }) => {
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
    });
    return {
      day: daySum,
      week: weekSum,
      month: monthSum,
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
      <header className="surface-muted text-base-content/70 grid gap-4 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Pagos hoy</p>
          <p className="text-base-content text-xl font-semibold">{currencyFormatter.format(totals.day)}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Semana en curso</p>
          <p className="text-base-content text-xl font-semibold">{currencyFormatter.format(totals.week)}</p>
        </div>
        <div>
          <p className="text-base-content/50 text-xs tracking-wide uppercase">Mes en curso</p>
          <p className="text-base-content text-xl font-semibold">{currencyFormatter.format(totals.month)}</p>
        </div>
      </header>

      <div className="surface-recessed text-base-content/70 space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base-content/50 text-sm font-semibold tracking-wide uppercase">Agenda unificada</h2>
            <p className="text-base-content/40 text-xs">
              Visualiza todos los pagos programados por fecha de vencimiento.
            </p>
          </div>
          {loading && (
            <div className="text-base-content/40 flex items-center gap-2 text-xs">
              <span className={LOADING_SPINNER_XS} aria-hidden="true" />
              <span>Actualizando agenda…</span>
            </div>
          )}
        </div>
        {error && <p className="text-error text-xs">{error}</p>}
        {groups.length === 0 && !loading && !error && (
          <p className="text-base-content/40 text-xs">No hay cuotas programadas en el periodo consultado.</p>
        )}
        {loading && groups.length === 0 && (
          <div className="space-y-2">
            {skeletons.map((value) => (
              <div key={value} className="border-base-300/60 bg-base-200/60 rounded-2xl border p-4 shadow-inner">
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
        <div className="muted-scrollbar max-h-128 space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => {
            const isExpanded = expanded[group.dateKey] ?? false;
            return (
              <article key={group.dateKey} className="surface-muted hover:border-primary/35 transition hover:shadow-lg">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => toggle(group.dateKey)}
                >
                  <div>
                    <p className="text-base-content text-sm font-semibold capitalize">{group.label}</p>
                    <p className="text-base-content/40 text-xs">
                      {group.entries.length} {group.entries.length === 1 ? "servicio" : "servicios"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base-content text-sm font-semibold">
                      {currencyFormatter.format(group.total)}
                    </span>
                    <span
                      className={`border-base-300 bg-base-100/70 text-base-content/50 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      ⌃
                    </span>
                  </div>
                </Button>
                {isExpanded && (
                  <div className="border-base-300/70 space-y-2 border-t px-4 py-3">
                    {group.entries.map(({ service, schedule }) => {
                      const dueDate = dayjs(schedule.due_date);
                      const diffDays = dueDate.startOf("day").diff(dayjs().startOf("day"), "day");
                      const isOverdue = schedule.status === "PENDING" && diffDays < 0;
                      return (
                        <div
                          key={`${service.public_id}-${schedule.id}`}
                          className="surface-recessed hover:border-primary/40 p-3 transition"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-base-content text-sm font-semibold">{service.name}</p>
                              {service.detail && <p className="text-base-content/40 text-xs">{service.detail}</p>}
                              <p className="text-base-content/40 mt-1 text-xs">
                                {currencyFormatter.format(schedule.expected_amount)} · Vence el{" "}
                                {dateFormatter.format(dueDate.toDate())}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
                                statusClasses[schedule.status]
                              }`}
                            >
                              {schedule.status === "PENDING" && isOverdue ? "Pendiente · Vencido" : schedule.status}
                            </span>
                          </div>
                          {canManage && (
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              {(schedule.status === "PENDING" || schedule.status === "PARTIAL") && (
                                <Button size="sm" onClick={() => onRegisterPayment(service.public_id, schedule)}>
                                  Registrar pago
                                </Button>
                              )}
                              {schedule.transaction_id && schedule.status === "PAID" && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => onUnlinkPayment(service.public_id, schedule)}
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
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
