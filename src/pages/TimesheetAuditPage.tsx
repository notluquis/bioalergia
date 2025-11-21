/**
 * Timesheet Audit Page
 * Dedicated space for auditing employee schedules across multiple weeks/periods
 */

import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/es";

import { useAuth } from "../context/AuthContext";
import Alert from "../components/ui/Alert";
import { fetchEmployees } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import { TimesheetAuditCalendar, EmployeeAuditSelector } from "../features/timesheets-audit/components";
import { detectAllOverlaps } from "../features/timesheets-audit/utils/overlapDetection";
import { useMonths } from "../features/timesheets/hooks/useMonths";
import { useTimesheetAudit, type AuditDateRange } from "../features/timesheets-audit/hooks/useTimesheetAudit";

dayjs.extend(isoWeek);
dayjs.locale("es");

type WeekDefinition = {
  key: string;
  month: string;
  number: number;
  label: string;
  start: string;
  end: string;
};

function buildWeeksForMonth(month: string): WeekDefinition[] {
  const baseDate = dayjs(`${month}-01`);
  const monthStart = baseDate.startOf("month");
  const monthEnd = baseDate.endOf("month");

  const weeks: WeekDefinition[] = [];
  const seen = new Set<number>();
  let cursor = monthStart.startOf("isoWeek");

  while (cursor.isBefore(monthEnd) || cursor.isSame(monthEnd, "day")) {
    const weekNumber = cursor.isoWeek();
    if (!seen.has(weekNumber)) {
      const weekStart = cursor.startOf("isoWeek");
      const weekEnd = cursor.endOf("isoWeek");
      const clampedStart = weekStart.isBefore(monthStart) ? monthStart : weekStart;
      const clampedEnd = weekEnd.isAfter(monthEnd) ? monthEnd : weekEnd;
      weeks.push({
        key: `${month}:${weekNumber}`,
        month,
        number: weekNumber,
        label: `Semana ${weekNumber} (${clampedStart.format("D MMM")} - ${clampedEnd.format("D MMM")})`,
        start: clampedStart.format("YYYY-MM-DD"),
        end: clampedEnd.format("YYYY-MM-DD"),
      });
      seen.add(weekNumber);
    }
    cursor = cursor.add(1, "week");
  }

  return weeks;
}

export default function TimesheetAuditPage() {
  useAuth(); // Ensure auth is validated

  const { months, loading: loadingMonths } = useMonths();
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  const monthWeekMap = useMemo(() => {
    const map = new Map<string, WeekDefinition[]>();
    months.forEach((month) => {
      map.set(month, buildWeeksForMonth(month));
    });
    return map;
  }, [months]);

  // Load employees once
  useEffect(() => {
    async function loadEmployees() {
      try {
        const data = await fetchEmployees(false);
        setEmployees(data);
      } catch (err) {
        console.error("Error loading employees:", err);
      } finally {
        setLoadingEmployees(false);
      }
    }
    loadEmployees();
  }, []);

  // Select default months (previous month if available, otherwise first on list)
  useEffect(() => {
    if (!months.length) return;
    setSelectedMonths((prev) => {
      if (prev.length) {
        return prev.filter((m) => months.includes(m));
      }
      const previousMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      if (months.includes(previousMonth)) return [previousMonth];
      const firstMonth = months[0];
      return firstMonth ? [firstMonth] : prev;
    });
  }, [months]);

  // Ensure week selection is aligned with selected months
  useEffect(() => {
    if (!selectedMonths.length) {
      setSelectedWeekKeys([]);
      return;
    }

    setSelectedWeekKeys((prev) => {
      const allowedKeys = new Set<string>();
      selectedMonths.forEach((month) => {
        (monthWeekMap.get(month) ?? []).forEach((week) => allowedKeys.add(week.key));
      });
      const filtered = prev.filter((key) => allowedKeys.has(key));
      if (filtered.length) return filtered;
      const fallbackMonth = selectedMonths[0];
      if (!fallbackMonth) return filtered;
      const fallbackWeeks = monthWeekMap.get(fallbackMonth);
      if (fallbackWeeks && fallbackWeeks.length) {
        const firstWeek = fallbackWeeks[0];
        if (firstWeek) {
          return [firstWeek.key];
        }
      }
      return filtered;
    });
  }, [selectedMonths, monthWeekMap]);

  const visibleWeeks = useMemo(
    () =>
      selectedMonths.flatMap((month) => {
        const weeks = monthWeekMap.get(month);
        return weeks ?? [];
      }),
    [selectedMonths, monthWeekMap]
  );

  const selectedWeekRanges = useMemo(() => {
    return selectedWeekKeys
      .map((key) => {
        const [month, weekNumberRaw] = key.split(":");
        if (!month || !weekNumberRaw) return undefined;
        const weekNumber = Number(weekNumberRaw);
        return monthWeekMap.get(month)?.find((week) => week.number === weekNumber);
      })
      .filter((week): week is WeekDefinition => Boolean(week))
      .map((week) => ({ start: week.start, end: week.end }));
  }, [selectedWeekKeys, monthWeekMap]);

  const selectedMonthRanges = useMemo(() => {
    return selectedMonths.map<AuditDateRange>((month) => {
      const base = dayjs(`${month}-01`);
      return {
        start: base.startOf("month").format("YYYY-MM-DD"),
        end: base.endOf("month").format("YYYY-MM-DD"),
      };
    });
  }, [selectedMonths]);

  const effectiveRanges = useMemo(() => {
    if (selectedWeekRanges.length) return selectedWeekRanges;
    return selectedMonthRanges;
  }, [selectedWeekRanges, selectedMonthRanges]);

  const focusDate = effectiveRanges[0]?.start ?? null;

  const {
    entries,
    loading: loadingEntries,
    error: errorEntries,
  } = useTimesheetAudit({
    ranges: effectiveRanges,
    employeeIds: selectedEmployeeIds,
  });

  const overlapsByDate = useMemo(() => detectAllOverlaps(entries), [entries]);
  const totalOverlapDays = overlapsByDate.size;
  const totalOverlapPairs = Array.from(overlapsByDate.values()).reduce(
    (sum, info) => sum + info.total_overlapping_pairs,
    0
  );

  const primarySelectedMonth = selectedMonths[0] ?? null;

  const handleMonthToggle = (value: string) => {
    setSelectedMonths((prev) => {
      if (prev.includes(value)) {
        if (prev.length === 1) return prev; // Keep at least one month
        return prev.filter((month) => month !== value);
      }
      return [...prev, value];
    });
  };

  const handleWeekToggle = (key: string) => {
    setSelectedWeekKeys((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // keep at least one week selected
        return prev.filter((item) => item !== key);
      }
      return [...prev, key];
    });
  };

  const handleSelectAllWeeks = (month: string) => {
    const weeks = monthWeekMap.get(month) ?? [];
    if (!weeks.length) return;
    const weekKeys = weeks.map((week) => week.key);
    setSelectedWeekKeys((prev) => {
      const allSelected = weekKeys.every((key) => prev.includes(key));
      if (allSelected) {
        const remaining = prev.filter((key) => !weekKeys.includes(key));
        if (remaining.length) return remaining;
        const fallbackKey = weekKeys[0];
        return fallbackKey ? [fallbackKey] : remaining;
      }
      const merged = new Set(prev);
      weekKeys.forEach((key) => merged.add(key));
      return Array.from(merged);
    });
  };

  const formattedRangeSummary = useMemo(() => {
    if (!effectiveRanges.length) return "";
    const firstRange = effectiveRanges[0];
    const lastRange = effectiveRanges[effectiveRanges.length - 1];
    if (!firstRange || !lastRange) return "";
    const first = dayjs(firstRange.start);
    const last = dayjs(lastRange.end);
    return `${first.format("D MMM YYYY")} → ${last.format("D MMM YYYY")}`;
  }, [effectiveRanges]);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="typ-title text-base-content">Auditoría de horarios</h1>
        <p className="max-w-2xl text-sm text-base-content/70">
          Analiza turnos cruzados entre múltiples periodos y equipos. Selecciona varios meses, semanas o rangos
          específicos y detecta conflictos reales (excluimos combinaciones enfermero universitario + TENS).
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <aside className="surface-elevated space-y-6 p-6">
          <section className="space-y-3">
            <header className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/80">
                Meses a analizar
              </span>
              {loadingMonths && <span className="loading loading-spinner loading-xs text-primary" aria-hidden="true" />}
            </header>
            <div className="flex flex-wrap gap-2">
              {months.map((month) => {
                const active = selectedMonths.includes(month);
                const label = dayjs(`${month}-01`).format("MMM YYYY");
                return (
                  <button
                    key={month}
                    type="button"
                    className="toggle-chip"
                    data-active={active}
                    onClick={() => handleMonthToggle(month)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <header className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-base-content/80">
                Semanas seleccionadas
              </span>
              {primarySelectedMonth && (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                  onClick={() => handleSelectAllWeeks(primarySelectedMonth)}
                >
                  {selectedMonths.length === 1 ? "Alternar todas" : "Elegir primera tanda"}
                </button>
              )}
            </header>
            {visibleWeeks.length === 0 ? (
              <p className="text-xs text-base-content/60">Selecciona al menos un mes para ver sus semanas.</p>
            ) : (
              selectedMonths.map((month) => {
                const weeks = monthWeekMap.get(month) ?? [];
                return (
                  <div key={month} className="space-y-2">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-base-content/70">
                      <span>{dayjs(`${month}-01`).format("MMMM YYYY")}</span>
                      {weeks.length > 0 && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                          onClick={() => handleSelectAllWeeks(month)}
                        >
                          {weeks.every((week) => selectedWeekKeys.includes(week.key))
                            ? "Deseleccionar todo"
                            : "Seleccionar todo"}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {weeks.map((week) => {
                        const active = selectedWeekKeys.includes(week.key);
                        return (
                          <button
                            key={week.key}
                            type="button"
                            className="toggle-chip"
                            data-active={active}
                            onClick={() => handleWeekToggle(week.key)}
                          >
                            {`Sem ${week.number}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </section>
          {!loadingEmployees && (
            <EmployeeAuditSelector
              employees={employees}
              selectedIds={selectedEmployeeIds}
              onSelectionChange={setSelectedEmployeeIds}
              loading={loadingEntries}
            />
          )}
        </aside>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="surface-recessed px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Periodos activos</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {effectiveRanges.length} <span className="text-sm font-semibold text-base-content/60">intervalos</span>
              </p>
              {formattedRangeSummary && (
                <p className="mt-1 text-[11px] text-base-content/60">{formattedRangeSummary}</p>
              )}
            </div>
            <div className="surface-recessed px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Días con alertas</p>
              <p className="mt-2 text-2xl font-bold text-warning">{totalOverlapDays}</p>
              <p className="mt-1 text-[11px] text-base-content/60">Sólo contabilizamos conflictos reales</p>
            </div>
            <div className="surface-recessed px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-base-content/60">Pares en conflicto</p>
              <p className="mt-2 text-2xl font-bold text-error">{totalOverlapPairs}</p>
              <p className="mt-1 text-[11px] text-base-content/60">Excluyendo combinaciones enfermero + TENS</p>
            </div>
          </div>

          {errorEntries && <Alert variant="error">{errorEntries}</Alert>}

          {selectedEmployeeIds.length === 0 && (
            <Alert variant="error">Selecciona al menos 1 empleado para iniciar la auditoría.</Alert>
          )}

          {selectedEmployeeIds.length > 0 && !loadingEntries && entries.length === 0 && (
            <Alert variant="warning">
              No encontramos registros para los rangos seleccionados. Ajusta semanas o empleados y vuelve a intentar.
            </Alert>
          )}

          {selectedEmployeeIds.length > 0 && (
            <TimesheetAuditCalendar
              entries={entries}
              loading={loadingEntries}
              selectedEmployeeIds={selectedEmployeeIds}
              focusDate={focusDate}
              visibleDateRanges={effectiveRanges}
            />
          )}

          {selectedEmployeeIds.length > 0 && entries.length > 0 && (
            <div className="surface-recessed p-6">
              <h3 className="mb-4 font-semibold text-base-content">Guía de interpretación</h3>
              <ul className="space-y-3 text-sm text-base-content/70">
                <li className="flex gap-3">
                  <span className="font-semibold text-base-content">🎯 Intervalos:</span>
                  La vista agrupa todas las semanas seleccionadas; puedes alternar meses y semanas sin perder contexto.
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-base-content">🎨 Código de colores:</span>
                  <span>
                    <strong className="text-accent">Verde:</strong> Turnos sin conflicto.
                    <strong className="ml-3 text-error">Rojo:</strong> Horarios traslapados.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-base-content">👩‍⚕️ Compatibilidad:</span>
                  Ignoramos automáticamente combinaciones Enfermero/a Universitario + TENS, ya que pueden co-existir.
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-base-content">⌛ Tooltip detallado:</span>
                  Pasa el cursor para ver rol, duración y si existe alerta de conflicto.
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
