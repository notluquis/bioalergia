import { useMemo, useState } from "react";
import dayjs from "dayjs";
import type { ServiceSchedule, ServiceSummary } from "../types";
import Button from "../../../components/Button";

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

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

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
  PENDING: "bg-amber-100 text-amber-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
  SKIPPED: "bg-slate-100 text-slate-600",
};

export default function ServicesUnifiedAgenda({
  items,
  loading,
  error,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServicesUnifiedAgendaProps) {
  const groups = useMemo<AgendaGroup[]>(() => {
    if (!items.length) return [];
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
    return Array.from(map.values()).sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  }, [items]);

  const totals = useMemo(() => {
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
  }, [items]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const todayKey = dayjs().format("YYYY-MM-DD");
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
      <header className="grid gap-4 border border-white/40 p-4 text-sm text-slate-600 sm:grid-cols-3 bg-base-100">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Pagos hoy</p>
          <p className="text-xl font-semibold text-slate-800">{currencyFormatter.format(totals.day)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Semana en curso</p>
          <p className="text-xl font-semibold text-slate-800">{currencyFormatter.format(totals.week)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Mes en curso</p>
          <p className="text-xl font-semibold text-slate-800">{currencyFormatter.format(totals.month)}</p>
        </div>
      </header>

      <div className="space-y-3 border border-white/40 p-4 text-sm text-slate-600 bg-base-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Agenda unificada</h2>
            <p className="text-xs text-slate-400">Visualiza todos los pagos programados por fecha de vencimiento.</p>
          </div>
          {loading && <span className="text-xs text-slate-400">Actualizando agenda…</span>}
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        {!groups.length && !loading && !error && (
          <p className="text-xs text-slate-400">No hay cuotas programadas en el periodo consultado.</p>
        )}
        <div className="muted-scrollbar max-h-128 space-y-2 overflow-y-auto pr-1">
          {groups.map((group) => {
            const isExpanded = expanded[group.dateKey] ?? false;
            return (
              <article
                key={group.dateKey}
                className="rounded-2xl border border-white/45 bg-base-100/70 shadow-sm transition hover:border-(--brand-primary)/35"
              >
                <Button
                  type="button"
                  variant="secondary"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => toggle(group.dateKey)}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700 capitalize">{group.label}</p>
                    <p className="text-xs text-slate-400">
                      {group.entries.length} {group.entries.length === 1 ? "servicio" : "servicios"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700">
                      {currencyFormatter.format(group.total)}
                    </span>
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-base-100/70 text-xs font-semibold text-slate-500 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    >
                      ⌃
                    </span>
                  </div>
                </Button>
                {isExpanded && (
                  <div className="space-y-2 border-t border-white/55 px-4 py-3">
                    {group.entries.map(({ service, schedule }) => {
                      const dueDate = dayjs(schedule.due_date);
                      const diffDays = dueDate.startOf("day").diff(dayjs().startOf("day"), "day");
                      const isOverdue = schedule.status === "PENDING" && diffDays < 0;
                      return (
                        <div
                          key={`${service.public_id}-${schedule.id}`}
                          className="rounded-xl border border-white/50 bg-base-100/80 p-3 shadow-inner transition hover:border-(--brand-primary)/40"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-700">{service.name}</p>
                              {service.detail && <p className="text-xs text-slate-400">{service.detail}</p>}
                              <p className="mt-1 text-xs text-slate-400">
                                {currencyFormatter.format(schedule.expected_amount)} · Vence el{" "}
                                {dateFormatter.format(dueDate.toDate())}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
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
  if (!value.length) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
