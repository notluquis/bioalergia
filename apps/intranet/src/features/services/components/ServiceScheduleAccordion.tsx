import { Description } from "@heroui/react";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { today } from "@/lib/dates";
import { currencyFormatter } from "@/lib/format";

import type { ServiceSchedule, ServiceSummary } from "../types";

interface ScheduleGroup {
  dateKey: string;
  items: ServiceSchedule[];
  label: string;
}

interface ServiceScheduleAccordionProps {
  canManage: boolean;
  onRegisterPayment: (schedule: ServiceSchedule) => void;
  onUnlinkPayment: (schedule: ServiceSchedule) => void;
  schedules: ServiceSchedule[];
  service: ServiceSummary;
}

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  weekday: "long",
});

function canUnlink(schedule: ServiceSchedule) {
  if (!schedule.transactionId) {
    return false;
  }
  if (schedule.status !== "PAID") {
    return false;
  }
  return true;
}
export { ServiceScheduleAccordion };

function capitalize(value: string) {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getRelativeDayLabel(dueDate: dayjs.Dayjs, todayDate: dayjs.Dayjs) {
  const diff = dueDate.diff(todayDate, "day");
  if (diff === -1) {
    return "Ayer";
  }
  if (diff === 0) {
    return "Hoy";
  }
  if (diff === 1) {
    return "Mañana";
  }
  if (diff > 1 && diff <= 5) {
    return `En ${diff} días`;
  }
  if (diff < -1 && diff >= -5) {
    return `Hace ${Math.abs(diff)} días`;
  }
  return capitalize(dateFormatter.format(dueDate.toDate()));
}

function buildScheduleGroups(schedules: ServiceSchedule[]): ScheduleGroup[] {
  if (schedules.length === 0) {
    return [];
  }

  const sorted = [...schedules].toSorted(
    (a, b) => dayjs(a.dueDate).valueOf() - dayjs(b.dueDate).valueOf(),
  );
  const todayDate = dayjs().startOf("day");
  const map = new Map<string, ScheduleGroup>();

  for (const schedule of sorted) {
    const dueDate = dayjs(schedule.dueDate).startOf("day");
    const key = dueDate.format("YYYY-MM-DD");
    if (!map.has(key)) {
      map.set(key, {
        dateKey: key,
        items: [],
        label: getRelativeDayLabel(dueDate, todayDate),
      });
    }
    const group = map.get(key);
    if (group) {
      group.items.push(schedule);
    }
  }

  return [...map.values()].toSorted((a, b) => (a.dateKey > b.dateKey ? 1 : -1));
}

function ServiceScheduleAccordion({
  canManage,
  onRegisterPayment,
  onUnlinkPayment,
  schedules,
  service,
}: ServiceScheduleAccordionProps) {
  const groups = buildScheduleGroups(schedules);

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
      for (const group of groups) {
        next[group.dateKey] = prev[group.dateKey] ?? group.dateKey === todayKey;
      }
      return next;
    });
  }, [groups]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (groups.length === 0) {
    return (
      <section className="space-y-3 rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm">
        <header className="flex items-center justify-between">
          <span className="font-semibold text-default-500 text-sm uppercase tracking-wide">
            Agenda de vencimientos
          </span>
        </header>
        <Description className="text-default-500 text-xs">
          No hay cuotas generadas para este servicio.
        </Description>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-2xl border border-default-200 bg-default-50 p-4 text-foreground text-sm">
      <header className="flex items-center justify-between">
        <span className="font-semibold text-default-500 text-sm uppercase tracking-wide">
          Agenda de vencimientos
        </span>
        <span className="text-default-400 text-xs">
          {service.pendingCount + service.overdueCount} pendientes totales
        </span>
      </header>
      <div className="muted-scrollbar max-h-none space-y-2 pr-1 sm:max-h-80 sm:overflow-y-auto sm:overscroll-y-contain">
        {groups.map((group) => {
          const isExpanded = expanded[group.dateKey] ?? false;
          return (
            <article
              className="rounded-xl border border-default-200 bg-default-50 shadow-sm"
              key={group.dateKey}
            >
              <Button
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-default-50"
                onPress={() => {
                  toggleGroup(group.dateKey);
                }}
                type="button"
                variant="ghost"
              >
                <div>
                  <span className="block font-semibold text-foreground text-sm capitalize">
                    {group.label}
                  </span>
                  <Description className="text-default-400 text-xs">
                    {group.items.length} {group.items.length === 1 ? "cuota" : "cuotas"}
                  </Description>
                </div>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-default-200 bg-default-50 font-semibold text-default-500 text-xs transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                >
                  ⌃
                </span>
              </Button>
              <div
                className={
                  isExpanded ? "space-y-2 border-default-200 border-t px-4 py-3" : "hidden"
                }
              >
                {group.items.map((item) => {
                  const dueDate = dayjs(item.dueDate);
                  const diffDays = dueDate.startOf("day").diff(dayjs().startOf("day"), "day");
                  const isOverdue = item.status === "PENDING" && diffDays < 0;
                  const statusClasses = {
                    PAID: "bg-success/20 text-success",
                    PARTIAL: "bg-warning/20 text-warning",
                    PENDING: "bg-warning/20 text-warning",
                    SKIPPED: "bg-default-50 text-default-500",
                  } as const;

                  return (
                    <div
                      className="rounded-xl border border-default-200 bg-default-50 p-3 shadow-inner transition hover:border-primary/40"
                      key={item.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="block font-semibold text-foreground text-sm">
                            {currencyFormatter.format(item.expectedAmount)}
                          </span>
                          <Description className="text-default-400 text-xs">
                            Vence el {dateFormatter.format(dueDate.toDate())}
                          </Description>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 font-semibold text-xs uppercase tracking-wide ${
                            statusClasses[item.status]
                          }`}
                        >
                          {item.status === "PENDING" && isOverdue
                            ? "Pendiente · Vencido"
                            : item.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-default-500 text-xs">
                        <span>
                          Periodo {dayjs(item.periodStart).format("DD MMM")} –{" "}
                          {dayjs(item.periodEnd).format("DD MMM YYYY")}
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
                            <Button
                              onClick={() => {
                                onRegisterPayment(item);
                              }}
                              size="sm"
                            >
                              Registrar pago
                            </Button>
                          )}
                          {item.transactionId && item.status === "PAID" && canUnlink(item) && (
                            <Button
                              onClick={() => {
                                onUnlinkPayment(item);
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
