import dayjs from "dayjs";
import { useEffect, useState } from "react";

import Button from "@/components/ui/Button";
import { today } from "@/lib/dates";
import { currencyFormatter } from "@/lib/format";

import type { ServiceSchedule, ServiceSummary } from "../types";

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

function ServiceScheduleAccordion({
  service,
  schedules,
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
}: ServiceScheduleAccordionProps) {
  const groups = (() => {
    if (schedules.length === 0) return [];

    const sorted = [...schedules].toSorted((a, b) => dayjs(a.due_date).valueOf() - dayjs(b.due_date).valueOf());

    const today = dayjs().startOf("day");
    const map = new Map<string, ScheduleGroup>();

    for (const schedule of sorted) {
      const dueDate = dayjs(schedule.due_date).startOf("day");
      const key = dueDate.format("YYYY-MM-DD");
      if (!map.has(key)) {
        const diff = dueDate.diff(today, "day");
        let label: string;

        switch (diff) {
          case 0: {
            label = "Hoy";
            break;
          }
          case 1: {
            label = "Mañana";
            break;
          }
          case -1: {
            label = "Ayer";
            break;
          }
          default: {
            if (diff > 1 && diff <= 5) label = `En ${diff} días`;
            else if (diff < -1 && diff >= -5) label = `Hace ${Math.abs(diff)} días`;
            else label = capitalize(dateFormatter.format(dueDate.toDate()));
          }
        }

        map.set(key, { dateKey: key, label, items: [] });
      }
      map.get(key)!.items.push(schedule);
    }

    return [...map.values()].toSorted((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
  })();

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const todayKey = today();
    return groups.reduce<Record<string, boolean>>((acc, group) => {
      acc[group.dateKey] = group.dateKey === todayKey;
      return acc;
    }, {});
  });

  useEffect(() => {
    const todayKey = today();
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

  if (groups.length === 0) {
    return (
      <section className="border-base-300 bg-base-200 text-base-content space-y-3 rounded-2xl border p-4 text-sm">
        <header className="flex items-center justify-between">
          <h2 className="text-base-content/60 text-sm font-semibold tracking-wide uppercase">Agenda de vencimientos</h2>
        </header>
        <p className="text-base-content/60 text-xs">No hay cuotas generadas para este servicio.</p>
      </section>
    );
  }

  return (
    <section className="border-base-300 bg-base-200 text-base-content space-y-3 rounded-2xl border p-4 text-sm">
      <header className="flex items-center justify-between">
        <h2 className="text-base-content/60 text-sm font-semibold tracking-wide uppercase">Agenda de vencimientos</h2>
        <span className="text-base-content/50 text-xs">
          {service.pending_count + service.overdue_count} pendientes totales
        </span>
      </header>
      <div className="muted-scrollbar max-h-80 space-y-2 overflow-y-auto pr-1">
        {groups.map((group) => {
          const isExpanded = expanded[group.dateKey] ?? false;
          return (
            <article key={group.dateKey} className="border-base-300 bg-base-200 rounded-xl border shadow-sm">
              <button
                type="button"
                onClick={() => toggleGroup(group.dateKey)}
                className="hover:bg-base-200 flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors"
              >
                <div>
                  <p className="text-base-content text-sm font-semibold capitalize">{group.label}</p>
                  <p className="text-base-content/50 text-xs">
                    {group.items.length} {group.items.length === 1 ? "cuota" : "cuotas"}
                  </p>
                </div>
                <span
                  className={`border-base-300 bg-base-200 text-base-content/60 inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  ⌃
                </span>
              </button>
              <div className={`${isExpanded ? "border-base-300 space-y-2 border-t px-4 py-3" : "hidden"}`}>
                {group.items.map((item) => {
                  const dueDate = dayjs(item.due_date);
                  const diffDays = dueDate.startOf("day").diff(dayjs().startOf("day"), "day");
                  const isOverdue = item.status === "PENDING" && diffDays < 0;
                  const statusClasses = {
                    PENDING: "bg-warning/20 text-warning",
                    PARTIAL: "bg-warning/20 text-warning",
                    PAID: "bg-success/20 text-success",
                    SKIPPED: "bg-base-200 text-base-content/60",
                  } as const;

                  return (
                    <div
                      key={item.id}
                      className="border-base-300 bg-base-200 hover:border-primary/40 rounded-xl border p-3 shadow-inner transition"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-base-content text-sm font-semibold">
                            {currencyFormatter.format(item.expected_amount)}
                          </p>
                          <p className="text-base-content/50 text-xs">
                            Vence el {dateFormatter.format(dueDate.toDate())}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase ${
                            statusClasses[item.status]
                          }`}
                        >
                          {item.status === "PENDING" && isOverdue ? "Pendiente · Vencido" : item.status}
                        </span>
                      </div>
                      <div className="text-base-content/60 mt-2 flex flex-wrap items-center gap-4 text-xs">
                        <span>
                          Periodo {dayjs(item.period_start).format("DD MMM")} –{" "}
                          {dayjs(item.period_end).format("DD MMM YYYY")}
                        </span>
                        {item.transaction && (
                          <span className="text-success">
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

export default ServiceScheduleAccordion;

function capitalize(value: string) {
  if (value.length === 0) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function canUnlink(schedule: ServiceSchedule) {
  if (!schedule.transaction_id) return false;
  if (schedule.status !== "PAID") return false;
  return true;
}
