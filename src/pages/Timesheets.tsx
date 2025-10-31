import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { useAuth } from "../context/auth-context";
import Button from "../components/Button";
import { fetchEmployees } from "../features/employees/api";
import type { Employee } from "../features/employees/types";
import {
  fetchTimesheetSummary,
  fetchTimesheetDetail,
  bulkUpsertTimesheets,
  deleteTimesheet,
} from "../features/timesheets/api";
import type { BulkRow, TimesheetSummaryRow, TimesheetSummaryResponse } from "../features/timesheets/types";
import { buildBulkRows, hasRowData, isRowDirty, parseDuration, formatDateLabel } from "../features/timesheets/utils";
import TimesheetSummaryTable from "../features/timesheets/components/TimesheetSummaryTable";
import TimesheetDetailTable from "../features/timesheets/components/TimesheetDetailTable";
import Alert from "../components/Alert";
// Removed unused Input component after cleanup
import { useMonths } from "../features/timesheets/hooks/useMonths";

const TimesheetExportPDF = lazy(() => import("../features/timesheets/components/TimesheetExportPDF"));

// Removed unused EMPTY_BULK_ROW and computeExtraAmount during cleanup.

export default function TimesheetsPage() {
  // Utility to ensure month is always YYYY-MM
  function formatMonthString(m: string): string {
    if (/^[0-9]{4}-[0-9]{2}$/.test(m)) return m;
    // Try to parse with dayjs
    const d = dayjs(m, ["YYYY-MM", "YYYY/MM", "MM/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]);
    if (d.isValid()) return d.format("YYYY-MM");
    return dayjs().format("YYYY-MM"); // fallback to current month
  }
  useAuth(); // invoke to ensure auth refresh (no direct usage of hasRole here)
  // canEdit removed (unused in current UI flow)

  const { months, loading: loadingMonths } = useMonths();
  const [month, setMonth] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(5);
  const [summary, setSummary] = useState<
    { employees: TimesheetSummaryRow[]; totals: TimesheetSummaryResponse["totals"] } | null
  >(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [initialRows, setInitialRows] = useState<BulkRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await fetchEmployees(false);
      setEmployees(data);
      if (!selectedEmployeeId && data.length) {
        setSelectedEmployeeId(data[0].id);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los trabajadores";
      setError(message);
    }
  }, [selectedEmployeeId]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (months.length && !month) {
      setMonth(months[0]);
    }
  }, [months, month]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError(null);
    setInfo(null);
    try {
      const formattedMonth = formatMonthString(month);
      const data = await fetchTimesheetSummary(formattedMonth);
      setSummary({ employees: data.employees, totals: data.totals });
      const hasDataIds = new Set(data.employees.map((e) => e.employeeId));
      if (!selectedEmployeeId && data.employees.length) {
        setSelectedEmployeeId(data.employees[0].employeeId);
      } else if (selectedEmployeeId && !hasDataIds.has(selectedEmployeeId) && data.employees.length) {
        setSelectedEmployeeId(data.employees[0].employeeId);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el resumen";
      setError(message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [month, selectedEmployeeId]);

  useEffect(() => {
    if (month) loadSummary();
  }, [month, loadSummary]);

  const monthLabel = useMemo(() => {
    const [year, monthStr] = month.split("-");
    return dayjs(`${year}-${monthStr}-01`).format("MMMM YYYY");
  }, [month]);

  const employeeOptions = useMemo(() => employees.filter((employee) => employee.status === "ACTIVE"), [employees]);

  const selectedEmployee = useMemo(
    () => (selectedEmployeeId ? (employees.find((employee) => employee.id === selectedEmployeeId) ?? null) : null),
    [employees, selectedEmployeeId]
  );

  const employeeSummaryRow = useMemo(() => {
    if (!summary || !selectedEmployee) return null;
    return summary.employees.find((e) => e.employeeId === selectedEmployee.id) ?? null;
  }, [summary, selectedEmployee]);

  const loadDetail = useCallback(
    async (employeeId: number) => {
      setLoadingDetail(true);
      setError(null);
      try {
        const formattedMonth = formatMonthString(month);
        const data = await fetchTimesheetDetail(employeeId, formattedMonth);
        const rows = buildBulkRows(formattedMonth, data.entries);
        setBulkRows(rows);
        setInitialRows(rows);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo obtener el detalle";
        setError(message);
        setBulkRows([]);
        setInitialRows([]);
      } finally {
        setLoadingDetail(false);
      }
    },
    [month]
  );

  useEffect(() => {
    if (selectedEmployeeId) {
      loadDetail(selectedEmployeeId);
    } else {
      setBulkRows([]);
      setInitialRows([]);
    }
  }, [selectedEmployeeId, loadDetail]);

  const pendingCount = useMemo(() => bulkRows.filter((row) => !row.entryId && hasRowData(row)).length, [bulkRows]);

  const modifiedCount = useMemo(
    () => bulkRows.filter((row, index) => isRowDirty(row, initialRows[index])).length,
    [bulkRows, initialRows]
  );

  function handleRowChange(index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) {
    setBulkRows((prev) => {
      if (prev[index][field] === value) return prev;
      const next = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      return next;
    });
    setInfo(null);
  }

  function handleResetRow(index: number) {
    setBulkRows((prev) => {
      const next = [...prev];
      next[index] = { ...initialRows[index] };
      return next;
    });
    setInfo(null);
  }

  async function handleRemoveEntry(row: BulkRow) {
    if (!row.entryId) return;
    if (!confirm("¿Eliminar el registro de este día?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteTimesheet(row.entryId);
      if (selectedEmployeeId) {
        await loadSummary();
        await loadDetail(selectedEmployeeId);
      }
      setInfo("Registro eliminado");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo eliminar el registro";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkSave() {
    if (!selectedEmployeeId) {
      setError("Selecciona un trabajador para guardar las horas");
      return;
    }

    setError(null);
    setInfo(null);

    const entries: Array<{
      work_date: string;
      start_time: string | null;
      end_time: string | null;
      overtime_minutes: number;
      extra_amount: number;
      comment: string | null;
    }> = [];
    const removeIds: number[] = [];

    for (let index = 0; index < bulkRows.length; index += 1) {
      const row = bulkRows[index];
      const initial = initialRows[index];
      if (!isRowDirty(row, initial)) continue;

      // Validar entrada/salida si están presentes
      if (row.entrada && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.entrada)) {
        setError(`Hora de entrada inválida en ${formatDateLabel(row.date)}. Usa formato HH:MM (24 hrs).`);
        return;
      }
      if (row.salida && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.salida)) {
        setError(`Hora de salida inválida en ${formatDateLabel(row.date)}. Usa formato HH:MM (24 hrs).`);
        return;
      }

      const overtime = parseDuration(row.overtime);
      if (overtime === null) {
        setError(`Horas extra inválidas en ${formatDateLabel(row.date)}. Usa HH:MM.`);
        return;
      }

      const comment = row.comment.trim() ? row.comment.trim() : null;
      const hasContent = Boolean(row.entrada) || Boolean(row.salida) || overtime > 0 || Boolean(comment);

      if (!hasContent && row.entryId) {
        removeIds.push(row.entryId);
        continue;
      }

      if (!hasContent) {
        continue;
      }

      entries.push({
        work_date: row.date,
        start_time: row.entrada || null,
        end_time: row.salida || null,
        overtime_minutes: overtime,
        extra_amount: 0, // Por ahora no manejamos extra_amount separado
        comment,
      });
    }

    if (!entries.length && !removeIds.length) {
      setInfo("No hay cambios para guardar");
      return;
    }

    setSaving(true);
    try {
      await bulkUpsertTimesheets(selectedEmployeeId, entries, removeIds);
      await loadSummary();
      await loadDetail(selectedEmployeeId);
      setInfo("Cambios guardados correctamente");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--brand-primary)]">Registro de horas y pagos</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            Consolida horas trabajadas, extras y montos líquidos por trabajador. Selecciona el mes, revisa el resumen y
            completa la tabla diaria sin volver a guardar cada fila.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-500">Periodo</label>
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setInfo(null);
            }}
            className="rounded border px-3 py-2 text-sm bg-base-100"
            disabled={loadingMonths}
          >
            {months.slice(0, visibleCount).map((m) => (
              <option key={m} value={m}>
                {dayjs(m + "-01").format("MMMM YYYY")}
              </option>
            ))}
          </select>
          {months.length > visibleCount && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="text-xs text-[var(--brand-primary)] underline mt-1"
              onClick={() => setVisibleCount((c) => c + 4)}
            >
              Ver más meses...
            </Button>
          )}
        </div>
      </div>

      {/* Botón de exportar PDF */}
      {selectedEmployee && (
        <div className="flex justify-end">
          <Suspense
            fallback={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled
                  variant="primary"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[var(--brand-primary)]/70 cursor-wait"
                >
                  Cargando exportador...
                </Button>
              </div>
            }
          >
            <TimesheetExportPDF
              logoUrl={"/logo.png"}
              employee={selectedEmployee}
              summary={employeeSummaryRow || null}
              bulkRows={bulkRows}
              columns={["date", "entrada", "salida", "worked", "overtime"]}
              monthLabel={monthLabel}
              monthRaw={month}
            />
          </Suspense>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {info && <Alert variant="success">{info}</Alert>}

      <TimesheetSummaryTable
        summary={summary}
        loading={loadingSummary}
        selectedEmployeeId={selectedEmployeeId}
        onSelectEmployee={setSelectedEmployeeId}
      />

      <TimesheetDetailTable
        bulkRows={bulkRows}
        initialRows={initialRows}
        loadingDetail={loadingDetail}
        selectedEmployee={selectedEmployee}
        onRowChange={handleRowChange}
        onResetRow={handleResetRow}
        onRemoveEntry={handleRemoveEntry}
        onBulkSave={handleBulkSave}
        saving={saving}
        pendingCount={pendingCount}
        modifiedCount={modifiedCount}
        monthLabel={monthLabel}
        employeeOptions={employeeOptions}
      />
    </section>
  );
}
