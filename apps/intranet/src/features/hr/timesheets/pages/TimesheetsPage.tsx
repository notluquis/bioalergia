import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Suspense, useState } from "react";

import { Select, SelectItem } from "@/components/ui/Select";
import { useAuth } from "@/context/AuthContext";
import { employeeKeys } from "@/features/hr/employees/queries";
import { fetchTimesheetSummary } from "@/features/hr/timesheets/api";
import TimesheetEditor from "@/features/hr/timesheets/components/TimesheetEditor";
import TimesheetSummaryTable from "@/features/hr/timesheets/components/TimesheetSummaryTable";
import { useMonths } from "@/features/hr/timesheets/hooks/use-months";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

const MONTH_STRING_REGEX = /^\d{4}-\d{2}$/;

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
  const selectedEmployee = selectedEmployeeId
    ? (employees.find((e) => e.id === selectedEmployeeId) ?? null)
    : null;

  // 2. Summary (Depends on Month + potentially SelectedEmployee)
  const { data: summaryData } = useSuspenseQuery({
    queryFn: () => fetchTimesheetSummary(formatMonthString(month), selectedEmployeeId),
    queryKey: ["timesheet-summary", month, selectedEmployeeId],
  });

  const employeeSummaryRow = (() => {
    if (!summaryData || !selectedEmployee) {
      return null;
    }
    return summaryData.employees.find((e) => e.employeeId === selectedEmployee.id) ?? null;
  })();

  const monthLabel = (() => {
    if (!month) {
      return "";
    }
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
            <Select
              className="w-full"
              isDisabled={activeEmployees.length === 0}
              label="Trabajador"
              placeholder="Seleccionar..."
              selectedKey={selectedEmployeeId ? String(selectedEmployeeId) : null}
              onSelectionChange={(key) => {
                const value = key ? Number(key) : null;
                setSelectedEmployeeId(value);
              }}
            >
              {activeEmployees.map((emp) => (
                <SelectItem id={String(emp.id)} key={emp.id}>
                  {emp.full_name}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="min-w-44">
            <Select
              className="w-full"
              label="Periodo"
              selectedKey={month}
              onSelectionChange={(key) => {
                if (key) {
                  setMonth(key.toString());
                }
              }}
            >
              {groupedMonths.flatMap((group) => [
                <SelectItem id={`year-${group.year}`} isDisabled key={`year-${group.year}`}>
                  {group.year}
                </SelectItem>,
                ...group.months.map((m) => {
                  const hasData = monthsWithData.has(m);
                  const label = dayjs(`${m}-01`).format("MMMM");
                  return (
                    <SelectItem id={m} key={m}>
                      {label} {hasData ? "✓" : ""}
                    </SelectItem>
                  );
                }),
              ])}
            </Select>
          </div>
        </div>
      </div>

      <TimesheetSummaryTable
        loading={false}
        onSelectEmployee={setSelectedEmployeeId}
        selectedEmployeeId={selectedEmployeeId}
        summary={
          summaryData ? { employees: summaryData.employees, totals: summaryData.totals } : null
        }
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
  if (MONTH_STRING_REGEX.test(m)) {
    return m;
  }
  const d = dayjs(m, ["YYYY-MM", "YYYY/MM", "MM/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]);
  if (d.isValid()) {
    return d.format("YYYY-MM");
  }
  return dayjs().format("YYYY-MM");
}
