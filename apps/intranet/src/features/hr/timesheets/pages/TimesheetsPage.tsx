import { Label, ListBox, Select, Surface } from "@heroui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { startTransition, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { employeeKeys } from "@/features/hr/employees/queries";
import { TimesheetEditor } from "@/features/hr/timesheets/components/TimesheetEditor";
import { TimesheetSummaryTable } from "@/features/hr/timesheets/components/TimesheetSummaryTable";
import { useMonths } from "@/features/hr/timesheets/hooks/use-months";
import { timesheetQueries } from "@/features/hr/timesheets/queries";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { PAGE_CONTAINER } from "@/lib/styles";

const MONTH_STRING_REGEX = /^\d{4}-\d{2}$/;
export function TimesheetsPage() {
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

  // 2. Summary (Month-level dataset; employee selection only drives the editor)
  const { data: summaryData } = useSuspenseQuery({
    ...timesheetQueries.summary(formatMonthString(month)),
  });

  const employeeSummaryRow = (() => {
    if (!summaryData || selectedEmployeeId == null) {
      return null;
    }
    return summaryData.employees.find((e) => e.employeeId === selectedEmployeeId) ?? null;
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
      <Surface
        className="rounded-[28px] border border-default-200/70 p-4 sm:p-5"
        variant="secondary"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-52">
            <Select
              className="w-full"
              isDisabled={activeEmployees.length === 0}
              placeholder="Seleccionar..."
              value={selectedEmployeeId ? String(selectedEmployeeId) : null}
              onChange={(key) => {
                const value = key ? Number(key) : null;
                startTransition(() => {
                  setSelectedEmployeeId(value);
                });
              }}
            >
              <Label>Prestador</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {activeEmployees.map((emp) => (
                    <ListBox.Item id={String(emp.id)} key={String(emp.id)}>
                      {emp.full_name}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="min-w-44">
            <Select
              className="w-full"
              value={month}
              onChange={(key) => {
                if (key) setMonth(key.toString());
              }}
            >
              <Label>Periodo</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {groupedMonths.flatMap((group) => [
                    <ListBox.Item id={`year-${group.year}`} isDisabled key={`year-${group.year}`}>
                      {group.year}
                    </ListBox.Item>,
                    ...group.months.map((m) => {
                      const hasData = monthsWithData.has(m);
                      const label = dayjs(`${m}-01`).format("MMMM");
                      return (
                        <ListBox.Item id={m} key={m}>
                          {label} {hasData ? "✓" : ""}
                        </ListBox.Item>
                      );
                    }),
                  ])}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>
      </Surface>

      <TimesheetSummaryTable
        loading={false}
        onSelectEmployee={setSelectedEmployeeId}
        selectedEmployeeId={selectedEmployeeId}
        summary={
          summaryData ? { employees: summaryData.employees, totals: summaryData.totals } : null
        }
      />

      {selectedEmployee && month && (
        <TimesheetEditor
          activeEmployees={activeEmployees}
          employeeId={selectedEmployee.id}
          month={month}
          monthLabel={monthLabel}
          selectedEmployee={selectedEmployee}
          summaryRow={employeeSummaryRow}
        />
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
