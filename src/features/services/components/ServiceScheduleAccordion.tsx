import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import type { ServiceSchedule, ServiceSummary } from "../types";
import Button from "../../../components/Button";

type ServiceScheduleAccordionProps = {
  service: ServiceSummary;
  schedules: ServiceSchedule[];
  canManage: boolean;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
};

type ScheduleGroup = {
  dateKey: string;
  label: string;
  items: ServiceSchedule[];
};

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  weekday: "long",
  day: "numeric",
  month: "short",
});

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export default function ServiceScheduleAccordion({
  service,
  schedules,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServiceScheduleAccordionProps) {
  const groups = useMemo<ScheduleGroup[]>(() => {
    if (!schedules.length) return [];

    const sorted = [...schedules].sort((a, b) =>
      dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf()
    );

    const today = dayjs().startOf("day");
    const map = new Map<string, ScheduleGroup>();

    for (const schedule of sorted) {
      const dueDate = dayjs(schedule.due_date).startOf("day");
      const key = dueDate.format("YYYY-MM-DD");
      if (!map.has(key)) {
        const diff = dueDate.diff(today, "day");
        let label: string;

        if (diff === 0) label = "Hoy";
        else if (diff === 1) label = "Mañana";
        else if (diff === -1) label = "Ayer";
        else if (diff > 1 && diff <= 5) label = `En ${diff} días`;
        else if (diff < -1 && diff >= -5) label = `Hace ${Math.abs(diff)} días`;
        else label = capitalize(dateFormatter.format(dueDate.toDate()));

        map.set(key, { dateKey: key, label, items: [] });
      }
      map.get(key)!.items.push(schedule);
    }

    return Array.from(map.values()).sort((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  }, [schedules]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const todayKey = dayjs().format("YYYY-MM-DD");
    return groups.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.dateKey] = group.dateKey === todayKey;
      return acc;
    }, {});
  });

  useEffect(() => {
    const todayKey = dayjs().format("YYYY-MM-DD");
    setExpanded((prev) => {
      const next: Record<string, boolean> = {};
      groups.forEach((group) => {
        next[group.dateKey] = prev[group.dateKey] ?? group.dateKey === todayKey;
      });
      return next;
    });
  }, [groups]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!groups.length) {
    return (
          <section className="space-y-3 rounded-2xl border border-white/55 bg-base-100/55 p-4 text-sm text-slate-600">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Agenda de vencimientos
          </h2>
        </header>
        <p className="text-xs text-slate-500">No hay cuotas generadas para este servicio.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-white/55 bg-base-100/55 p-4 text-sm text-slate-600">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Agenda de vencimientos
        </h2>
        <span className="text-xs text-slate-400">
          {service.pending_count + service.overdue_count} pendientes totales
        </span>
      </header>
      <div className="muted-scrollbar max-h-80 space-y-2 overflow-y-auto pr-1">
        {groups.map((group) => {
          const isExpanded = expanded[group.dateKey] ?? false;
          return (
            <article key={group.dateKey} className="rounded-xl border border-white/50 bg-base-100/65 shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(group.dateKey)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-base-100/70"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700 capitalize">{group.label}</p>
                  <p className="text-xs text-slate-400">
                    {group.items.length} {group.items.length === 1 ? "cuota" : "cuotas"}
                  </p>
                </div>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/60 bg-base-100/70 text-xs font-semibold text-slate-500 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  ⌃
                </span>
              </button>
              <div className={`${isExpanded ? "space-y-2 border-t border-white/60 px-4 py-3" : "hidden"}`}>
                {group.items.map((item) => {
                  const dueDate = dayjs(item.due_date);
                  const diffDays = dueDate.startOf("day").diff(dayjs().startOf("day"), "day");
                  const isOverdue = item.status === "PENDING" && diffDays < 0;
                  const statusClasses = {
                    PENDING: "bg-amber-100 text-amber-700",
                    PARTIAL: "bg-amber-100 text-amber-700",
                    PAID: "bg-emerald-100 text-emerald-700",
                    SKIPPED: "bg-slate-100 text-slate-600",
                  } as const;

                  return (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/50 bg-base-100/80 p-3 shadow-inner transition hover:border-[var(--brand-primary)]/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">
                            {currencyFormatter.format(item.expected_amount)}
                          </p>
                          <p className="text-xs text-slate-400">
                            Vence el {dateFormatter.format(dueDate.toDate())}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            statusClasses[item.status]
                          }`}
                        >
                          {item.status === "PENDING" && isOverdue ? "Pendiente · Vencido" : item.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>
                          Periodo {dayjs(item.period_start).format("DD MMM")} –{" "}
                          {dayjs(item.period_end).format("DD MMM YYYY")}
                        </span>
                        {item.transaction && (
                          <span className="text-emerald-600">
                            Pago {currencyFormatter.format(item.transaction.amount ?? 0)} ·{" "}
                            {dayjs(item.transaction.timestamp).format("DD MMM")}
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          {(item.status === "PENDING" || item.status === "PARTIAL") && (
                            <Button size="sm" onClick={() => onRegisterPayment(item)}>
                              Registrar pago
                            </Button>
                          )}
                          {item.transaction_id && item.status === "PAID" && canUnlink(item) && (
                            <Button size="sm" variant="secondary" onClick={() => onUnlinkPayment(item)}>
                              Desvincular pago
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function capitalize(value: string) {
  if (!value.length) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function canUnlink(schedule: ServiceSchedule) {
  if (!schedule.transaction_id) return false;
  if (schedule.status !== "PAID") return false;
  return true;
}
