import { lazy, Suspense, useCallback, useEffect, useMemo, useState, useRef, type ChangeEvent } from "react";
import dayjs from "dayjs";
import { useAuth } from "@/context/AuthContext";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { fetchEmployees } from "@/features/hr/employees/api";
import type { Employee } from "@/features/hr/employees/types";
import {
  fetchTimesheetSummary,
  fetchTimesheetDetail,
  bulkUpsertTimesheets,
  deleteTimesheet,
} from "@/features/hr/timesheets/api";
import type { BulkRow, TimesheetSummaryRow, TimesheetSummaryResponse } from "@/features/hr/timesheets/types";
import { buildBulkRows, hasRowData, isRowDirty, parseDuration, formatDateLabel } from "@/features/hr/timesheets/utils";
import TimesheetSummaryTable from "@/features/hr/timesheets/components/TimesheetSummaryTable";
import TimesheetDetailTable from "@/features/hr/timesheets/components/TimesheetDetailTable";
import Alert from "@/components/ui/Alert";
// Removed unused Input component after cleanup
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { useWakeLock } from "@/hooks/useWakeLock";

const TimesheetExportPDF = lazy(() => import("@/features/hr/timesheets/components/TimesheetExportPDF"));

// Removed unused EMPTY_BULK_ROW and computeExtraAmount during cleanup.

// Configuración de auto-guardado
const AUTO_SAVE_THRESHOLD = 5; // Guardar automáticamente cada N nuevos registros

export default function TimesheetsPage() {
  useWakeLock(); // Keep screen active during timesheet entry
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

  const { months, monthsWithData, loading: loadingMonths } = useMonths();
  const [month, setMonth] = useState<string>("");
  const [visibleCount, setVisibleCount] = useState(10);
  const [summary, setSummary] = useState<{
    employees: TimesheetSummaryRow[];
    totals: TimesheetSummaryResponse["totals"];
  } | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [initialRows, setInitialRows] = useState<BulkRow[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-save tracking
  const newEntriesCountRef = useRef(0);

  const loadEmployees = useCallback(async () => {
    try {
      const data = await fetchEmployees(false);
      setEmployees(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los trabajadores";
      setError(message);
    }
  }, []);

  // Load employees on mount
  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Set initial month when months list is loaded (previous month)
  useEffect(() => {
    if (months.length && !month) {
      const previousMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      const hasPreviousMonth = months.includes(previousMonth);
      setMonth(hasPreviousMonth ? previousMonth : (months[0] ?? ""));
    }
  }, [months, month]);

  // Consolidated effect: load summary and detail when month or selectedEmployeeId changes
  useEffect(() => {
    if (!month) return;

    // Limpiar datos inmediatamente al cambiar de empleado o mes para evitar confusión
    setBulkRows([]);
    setInitialRows([]);

    async function loadData() {
      // Load summary
      setLoadingSummary(true);
      setError(null);
      setInfo(null);
      try {
        const formattedMonth = formatMonthString(month);
        // Pasar selectedEmployeeId para mostrar solo ese empleado si está seleccionado
        const data = await fetchTimesheetSummary(formattedMonth, selectedEmployeeId);
        setSummary({ employees: data.employees, totals: data.totals });
        // No auto-seleccionar empleado - dejar que el usuario elija
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo obtener el resumen";
        setError(message);
        setSummary(null);
      } finally {
        setLoadingSummary(false);
      }

      // Load detail if employee selected
      if (selectedEmployeeId) {
        setLoadingDetail(true);
        setError(null);
        try {
          const formattedMonth = formatMonthString(month);
          const data = await fetchTimesheetDetail(selectedEmployeeId, formattedMonth);
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
      } else {
        setBulkRows([]);
        setInitialRows([]);
      }
    }

    loadData();
  }, [month, selectedEmployeeId]);

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

  const loadSummary = useCallback(async (monthParam: string, employeeId: number | null) => {
    if (!monthParam) return;
    setLoadingSummary(true);
    setError(null);
    setInfo(null);
    try {
      const formattedMonth = formatMonthString(monthParam);
      // Pasar employeeId para filtrar si hay uno seleccionado
      const data = await fetchTimesheetSummary(formattedMonth, employeeId);
      setSummary({ employees: data.employees, totals: data.totals });
      // No auto-seleccionar empleado en loadSummary
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo obtener el resumen";
      setError(message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadDetail = useCallback(async (employeeId: number, monthParam: string) => {
    if (!monthParam) return;
    setLoadingDetail(true);
    setError(null);
    try {
      const formattedMonth = formatMonthString(monthParam);
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
  }, []);

  const pendingCount = useMemo(() => bulkRows.filter((row) => !row.entryId && hasRowData(row)).length, [bulkRows]);

  const modifiedCount = useMemo(
    () => bulkRows.filter((row, index) => isRowDirty(row, initialRows[index])).length,
    [bulkRows, initialRows]
  );

  // Función para contar filas con datos nuevos (no guardadas aún)
  const countNewRowsWithData = useCallback((rows: BulkRow[], initial: BulkRow[]) => {
    return rows.filter((row, index) => {
      const init = initial[index];
      // Solo contar filas nuevas (sin entryId) que tienen datos y son dirty
      return !row.entryId && hasRowData(row) && isRowDirty(row, init);
    }).length;
  }, []);

  // Auto-save silencioso (no muestra mensaje de éxito para no interrumpir)
  const performAutoSave = useCallback(async () => {
    if (!selectedEmployeeId || saving) return;

    const entries: Array<{
      work_date: string;
      start_time: string | null;
      end_time: string | null;
      overtime_minutes: number;
      extra_amount: number;
      comment: string | null;
    }> = [];

    for (let index = 0; index < bulkRows.length; index += 1) {
      const row = bulkRows[index];
      const initial = initialRows[index];
      if (!row || !initial) continue;
      if (!isRowDirty(row, initial)) continue;

      // Skip invalid entries silently for auto-save
      if (row.entrada && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.entrada)) continue;
      if (row.salida && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.salida)) continue;

      const overtime = parseDuration(row.overtime);
      if (overtime === null) continue;

      const comment = row.comment.trim() ? row.comment.trim() : null;
      const hasContent = Boolean(row.entrada) || Boolean(row.salida) || overtime > 0 || Boolean(comment);

      if (!hasContent) continue;

      entries.push({
        work_date: row.date,
        start_time: row.entrada || null,
        end_time: row.salida || null,
        overtime_minutes: overtime,
        extra_amount: 0,
        comment,
      });
    }

    if (!entries.length) return;

    setSaving(true);
    try {
      await bulkUpsertTimesheets(selectedEmployeeId, entries, []);
      // Recargar datos silenciosamente
      if (month) {
        const formattedMonth = formatMonthString(month);
        const data = await fetchTimesheetDetail(selectedEmployeeId, formattedMonth);
        const rows = buildBulkRows(formattedMonth, data.entries);
        setBulkRows(rows);
        setInitialRows(rows);
        // Resetear contador
        newEntriesCountRef.current = 0;
        // Mostrar mensaje breve
        setInfo(`Auto-guardado: ${entries.length} registro${entries.length > 1 ? "s" : ""}`);
        // Limpiar mensaje después de 2 segundos
        setTimeout(() => setInfo(null), 2000);
      }
    } catch {
      // Silently fail for auto-save, user can manually save later
      console.warn("Auto-save failed, user can save manually");
    } finally {
      setSaving(false);
    }
  }, [selectedEmployeeId, saving, bulkRows, initialRows, month]);

  function handleRowChange(index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) {
    setBulkRows((prev) => {
      const currentRow = prev[index];
      if (!currentRow || currentRow[field] === value) return prev;
      const next = prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
      
      // Verificar si debemos auto-guardar
      const newCount = countNewRowsWithData(next, initialRows);
      if (newCount >= AUTO_SAVE_THRESHOLD && newCount > newEntriesCountRef.current) {
        // Disparar auto-guardado después de un pequeño delay para permitir más ediciones
        setTimeout(() => {
          performAutoSave();
        }, 500);
      }
      newEntriesCountRef.current = newCount;
      
      return next;
    });
    setInfo(null);
  }

  function handleResetRow(index: number) {
    setBulkRows((prev) => {
      const next = [...prev];
      const initialRow = initialRows[index];
      if (initialRow) next[index] = { ...initialRow };
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
      if (selectedEmployeeId && month) {
        await loadSummary(month, selectedEmployeeId);
        await loadDetail(selectedEmployeeId, month);
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
      if (!row || !initial) continue;
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
      if (month) {
        await loadSummary(month, selectedEmployeeId);
        await loadDetail(selectedEmployeeId, month);
      }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-primary">Registro de horas y pagos</h1>
          <p className="max-w-2xl text-sm text-base-content/70">
            Consolida horas trabajadas, extras y montos líquidos por trabajador. Selecciona el mes y trabajador, luego
            completa la tabla diaria sin volver a guardar cada fila.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Selector de Trabajador */}
          <div className="min-w-52">
            <Input
              label="Trabajador"
              as="select"
              value={selectedEmployeeId ?? ""}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value;
                setSelectedEmployeeId(value ? Number(value) : null);
                setInfo(null);
              }}
              disabled={!employeeOptions.length}
              className="bg-base-100"
            >
              <option value="">Seleccionar...</option>
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </Input>
          </div>
          {/* Selector de Periodo */}
          <div className="min-w-44">
            <Input
              label="Periodo"
              as="select"
              value={month}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setMonth(event.target.value);
                setInfo(null);
              }}
              disabled={loadingMonths}
              className="bg-base-100"
            >
              {months.slice(0, visibleCount).map((m) => {
                const hasData = monthsWithData.has(m);
                const label = dayjs(m + "-01").format("MMMM YYYY");
                return (
                  <option key={m} value={m}>
                    {hasData ? `${label} ✓` : label}
                  </option>
                );
              })}
            </Input>
            {months.length > visibleCount && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="text-xs text-primary underline mt-1"
                onClick={() => setVisibleCount((c) => c + 4)}
              >
                Ver más meses...
              </Button>
            )}
          </div>
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
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary/70 cursor-wait"
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

      {selectedEmployee && (
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
      )}
    </section>
  );
}
