import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { type ChangeEvent, Suspense, useState } from "react";

import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { employeeKeys } from "@/features/hr/employees/queries";
import { fetchTimesheetSummary } from "@/features/hr/timesheets/api";
import TimesheetEditor from "@/features/hr/timesheets/components/TimesheetEditor";
import TimesheetSummaryTable from "@/features/hr/timesheets/components/TimesheetSummaryTable";
import { useMonths } from "@/features/hr/timesheets/hooks/use-months";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

export default function TimesheetsPage() {
  useWakeLock();
  useAuth();

  // --- State ---
  const { months, monthsWithData } = useMonths();
  // Init month synchronously to previous month
  const [month, setMonth] = useState<string>(() => dayjs().subtract(1, "month").format("YYYY-MM"));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<null | number>(null);

  // --- Queries ---

  // 1. Employees
  const { data: employees } = useSuspenseQuery({
    ...employeeKeys.list({ includeInactive: false }),
    staleTime: 5 * 60 * 1000,
  });

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const selectedEmployee = selectedEmployeeId ? (employees.find((e) => e.id === selectedEmployeeId) ?? null) : null;

  // 2. Summary (Depends on Month + potentially SelectedEmployee)
  const { data: summaryData } = useSuspenseQuery({
    queryFn: () => fetchTimesheetSummary(formatMonthString(month), selectedEmployeeId),
    queryKey: ["timesheet-summary", month, selectedEmployeeId],
  });

  const employeeSummaryRow = (() => {
    if (!summaryData || !selectedEmployee) return null;
    return summaryData.employees.find((e) => e.employeeId === selectedEmployee.id) ?? null;
  })();

  const monthLabel = (() => {
    if (!month) return "";
    const [year, monthStr] = month.split("-");
    const d = dayjs(`${year}-${monthStr}-01`);
    return d.isValid() ? d.format("MMMM YYYY") : month;
  })();

  // Group months
  const groupedMonths = groupedMonthsMemo();
  function groupedMonthsMemo() {
    const years = [...new Set(months.map((m) => m.split("-")[0] || ""))];
    return years.map((year) => ({
      months: months.filter((m) => m.startsWith(year)),
      year,
    }));
  }

  return (
    <section className={PAGE_CONTAINER}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className={TITLE_LG}>Registro de horas y pagos</h1>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-52">
            <Input
              as="select"
              className="bg-base-100"
              disabled={activeEmployees.length === 0}
              label="Trabajador"
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value;
                setSelectedEmployeeId(value ? Number(value) : null);
              }}
              value={selectedEmployeeId ?? ""}
            >
              <option value="">Seleccionar...</option>
              {activeEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </Input>
          </div>
          <div className="min-w-44">
            <Input
              as="select"
              className="bg-base-100"
              label="Periodo"
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setMonth(event.target.value);
              }}
              value={month}
            >
              {groupedMonths.map((group) => (
                <optgroup key={group.year} label={group.year}>
                  {group.months.map((m) => {
                    const hasData = monthsWithData.has(m);
                    const label = dayjs(m + "-01").format("MMMM");
                    return (
                      <option key={m} value={m}>
                        {label} {hasData ? "✓" : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </Input>
          </div>
        </div>
      </div>

      <TimesheetSummaryTable
        loading={false}
        onSelectEmployee={setSelectedEmployeeId}
        selectedEmployeeId={selectedEmployeeId}
        summary={summaryData ? { employees: summaryData.employees, totals: summaryData.totals } : null}
      />

      {selectedEmployee && month && (
        <Suspense fallback={<div className="p-4 text-center">Cargando detalles...</div>}>
          <TimesheetEditor
            activeEmployees={activeEmployees}
            employeeId={selectedEmployee.id}
            month={month}
            monthLabel={monthLabel}
            selectedEmployee={selectedEmployee}
            summaryRow={employeeSummaryRow}
          />
        </Suspense>
      )}
    </section>
  );
}

// Utility to ensure month is always YYYY-MM
function formatMonthString(m: string): string {
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  const d = dayjs(m, ["YYYY-MM", "YYYY/MM", "MM/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]);
  if (d.isValid()) return d.format("YYYY-MM");
  return dayjs().format("YYYY-MM");
}
