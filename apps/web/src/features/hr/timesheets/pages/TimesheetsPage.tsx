import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { type ChangeEvent, lazy, Suspense, useEffect, useState } from "react";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { fetchEmployees } from "@/features/hr/employees/api";
import {
  bulkUpsertTimesheets,
  deleteTimesheet,
  fetchTimesheetDetail,
  fetchTimesheetSummary,
  prepareTimesheetEmail,
} from "@/features/hr/timesheets/api";
import EmailPreviewModal from "@/features/hr/timesheets/components/EmailPreviewModal";
import TimesheetDetailTable from "@/features/hr/timesheets/components/TimesheetDetailTable";
import TimesheetSummaryTable from "@/features/hr/timesheets/components/TimesheetSummaryTable";
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { generateTimesheetPdfBase64 } from "@/features/hr/timesheets/pdfUtils";
import type { BulkRow, TimesheetUpsertEntry } from "@/features/hr/timesheets/types";
import { buildBulkRows, formatDateLabel, hasRowData, isRowDirty, parseDuration } from "@/features/hr/timesheets/utils";
import { useWakeLock } from "@/hooks/useWakeLock";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

const TimesheetExportPDF = lazy(() => import("@/features/hr/timesheets/components/TimesheetExportPDF"));

export default function TimesheetsPage() {
  useWakeLock();
  const queryClient = useQueryClient();
  const { success: toastSuccess } = useToast();
  useAuth();

  // Utility to ensure month is always YYYY-MM
  function formatMonthString(m: string): string {
    if (/^[0-9]{4}-[0-9]{2}$/.test(m)) return m;
    const d = dayjs(m, ["YYYY-MM", "YYYY/MM", "MM/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]);
    if (d.isValid()) return d.format("YYYY-MM");
    return dayjs().format("YYYY-MM");
  }

  // --- State ---
  const { months, monthsWithData, loading: loadingMonths } = useMonths();
  const [month, setMonth] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);

  // Local state for the editable grid - separate from server state
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [initialRows, setInitialRows] = useState<BulkRow[]>([]);

  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPrepareStatus, setEmailPrepareStatus] = useState<string | null>(null);

  // Set initial month
  useEffect(() => {
    if (months.length && !month) {
      const previousMonth = dayjs().subtract(1, "month").format("YYYY-MM");
      setMonth(months.includes(previousMonth) ? previousMonth : (months[0] ?? ""));
    }
  }, [months, month]);

  // --- Queries ---

  // 1. Employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => fetchEmployees(false),
    staleTime: 5 * 60 * 1000,
  });

  const activeEmployees = employees.filter((e) => e.status === "ACTIVE");
  const selectedEmployee = selectedEmployeeId ? (employees.find((e) => e.id === selectedEmployeeId) ?? null) : null;

  // 2. Summary (Depends on Month + potentially SelectedEmployee)
  const {
    data: summaryData,
    isLoading: loadingSummary,
    error: summaryError,
  } = useQuery({
    queryKey: ["timesheet-summary", month, selectedEmployeeId],
    queryFn: () => fetchTimesheetSummary(formatMonthString(month), selectedEmployeeId),
    enabled: !!month,
  });

  const employeeSummaryRow = (() => {
    if (!summaryData || !selectedEmployee) return null;
    return summaryData.employees.find((e) => e.employeeId === selectedEmployee.id) ?? null;
  })();

  // 3. Detail (Depends on Month + SelectedEmployee)
  // We fetch this only when an employee is selected
  const {
    data: detailData,
    isLoading: loadingDetail,
    error: detailError,
  } = useQuery({
    queryKey: ["timesheet-detail", selectedEmployeeId, month],
    queryFn: () => fetchTimesheetDetail(selectedEmployeeId!, formatMonthString(month)),
    enabled: !!month && !!selectedEmployeeId,
  });

  // Sync fetched detail data to local editable rows
  useEffect(() => {
    if (detailData && month) {
      const rows = buildBulkRows(formatMonthString(month), detailData.entries);
      setBulkRows(rows);
      setInitialRows(rows);
      setErrorLocal(null);
    } else {
      // If we switch to no employee or month is invalid/loading, clear rows
      if (!selectedEmployeeId) {
        setBulkRows([]);
        setInitialRows([]);
      }
    }
  }, [detailData, month, selectedEmployeeId]);

  // --- Mutations ---

  const upsertMutation = useMutation({
    mutationFn: async (args: { employeeId: number; entries: TimesheetUpsertEntry[]; removeIds: number[] }) => {
      return bulkUpsertTimesheets(args.employeeId, args.entries, args.removeIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-detail"] });
      queryClient.invalidateQueries({ queryKey: ["timesheet-summary"] });
      // We don't toast here universally because row-save and bulk-save have different messages
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setErrorLocal(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return deleteTimesheet(entryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-detail"] });
      queryClient.invalidateQueries({ queryKey: ["timesheet-summary"] });
      toastSuccess("Registro eliminado");
    },
    onError: (err) => {
      setErrorLocal(err instanceof Error ? err.message : "Error al eliminar");
    },
  });

  // --- Handlers ---

  const handleRowChange = (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => {
    setBulkRows((prev) => {
      const currentRow = prev[index];
      if (!currentRow || currentRow[field] === value) return prev;

      return prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    });
  };

  const handleResetRow = (index: number) => {
    setBulkRows((prev) => {
      const next = [...prev];
      const initialRow = initialRows[index];
      if (initialRow) next[index] = { ...initialRow };
      return next;
    });
  };

  // Row Auto-Save
  const { mutateAsync: upsertMutate, isPending: isUpsertPending } = upsertMutation;

  const saveRowImmediately = async (index: number) => {
    if (!selectedEmployeeId || isUpsertPending) return;
    const row = bulkRows[index];
    const initial = initialRows[index];
    if (!row || !initial) return;

    const isComplete = Boolean(row.entrada?.trim()) && Boolean(row.salida?.trim());
    if (!isComplete || !isRowDirty(row, initial)) return;

    // Simple validation
    if (row.entrada && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.entrada)) return;
    if (row.salida && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.salida)) return;

    const overtime = parseDuration(row.overtime);
    if (overtime === null) return;

    const comment = row.comment.trim() ? row.comment.trim() : null;
    const entry = {
      work_date: row.date,
      start_time: row.entrada || null,
      end_time: row.salida || null,
      overtime_minutes: overtime,
      extra_amount: 0,
      comment,
    };

    try {
      await upsertMutate({
        employeeId: selectedEmployeeId,
        entries: [entry],
        removeIds: [],
      });
      toastSuccess(`Guardado: ${formatDateLabel(row.date)}`);
    } catch {
      // Error handled in mutation
    }
  };

  const handleSalidaBlur = (index: number) => {
    setTimeout(() => {
      saveRowImmediately(index);
    }, 100);
  };

  // Delete Mutation
  const { mutate: deleteMutate } = deleteMutation;

  const handleRemoveEntry = async (row: BulkRow) => {
    if (!row.entryId) return;
    if (!confirm("¿Eliminar el registro de este día?")) return;
    deleteMutate(row.entryId);
  };

  const handleBulkSave = async () => {
    if (!selectedEmployeeId) {
      setErrorLocal("Selecciona un trabajador para guardar las horas");
      return;
    }
    setErrorLocal(null);

    const entries: TimesheetUpsertEntry[] = [];
    const removeIds: number[] = [];

    for (let index = 0; index < bulkRows.length; index += 1) {
      const row = bulkRows[index];
      const initial = initialRows[index];
      if (!row || !initial || !isRowDirty(row, initial)) continue;

      if (row.entrada && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.entrada)) {
        setErrorLocal(`Hora de entrada inválida en ${formatDateLabel(row.date)}`);
        return;
      }
      if (row.salida && !/^[0-9]{1,2}:[0-9]{2}$/.test(row.salida)) {
        setErrorLocal(`Hora de salida inválida en ${formatDateLabel(row.date)}`);
        return;
      }

      const overtime = parseDuration(row.overtime);
      if (overtime === null) {
        setErrorLocal(`Horas extra inválidas en ${formatDateLabel(row.date)}`);
        return;
      }

      const comment = row.comment.trim() || null;
      const hasContent = Boolean(row.entrada) || Boolean(row.salida) || overtime > 0 || Boolean(comment);

      if (!hasContent && row.entryId) {
        removeIds.push(row.entryId);
        continue;
      }

      if (!hasContent) continue;

      entries.push({
        work_date: row.date,
        start_time: row.entrada ? dayjs(`${row.date} ${row.entrada}`).toISOString() : null,
        end_time: row.salida ? dayjs(`${row.date} ${row.salida}`).toISOString() : null,
        overtime_minutes: overtime,
        extra_amount: 0,
        comment,
      });
    }

    if (!entries.length && !removeIds.length) {
      toastSuccess("No hay cambios para guardar");
      return;
    }

    try {
      await upsertMutate({
        employeeId: selectedEmployeeId,
        entries,
        removeIds,
      });
      toastSuccess("Cambios guardados correctamente");
    } catch {
      // Error handled in mutation
    }
  };

  // PDF & Email Logic (kept mostly as is but using state/deps)
  const monthLabel = (() => {
    if (!month) return "";
    const [year, monthStr] = month.split("-");
    const d = dayjs(`${year}-${monthStr}-01`);
    return d.isValid() ? d.format("MMMM YYYY") : month;
  })();

  const generatePdfBase64 = async (): Promise<string | null> => {
    if (!selectedEmployee || !employeeSummaryRow) return null;
    return generateTimesheetPdfBase64(selectedEmployee, employeeSummaryRow, bulkRows, monthLabel);
  };

  // ... existing imports

  // --- Mutations ---

  // Add new mutation for email preparation
  const emailMutation = useMutation({
    mutationFn: prepareTimesheetEmail,
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al preparar el email";
      setErrorLocal(message);
      setEmailPrepareStatus(null);
    },
  });

  // ... existing mutations

  async function handlePrepareEmail() {
    if (!selectedEmployee || !employeeSummaryRow || !month) return;
    setEmailPrepareStatus("generating-pdf");
    setErrorLocal(null);

    try {
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) throw new Error("No se pudo generar el PDF");

      setEmailPrepareStatus("preparing");

      const data = await emailMutation.mutateAsync({
        employeeId: selectedEmployee.id,
        month,
        monthLabel,
        pdfBase64,
      });

      if (data.status !== "ok") throw new Error(data.message || "Error al preparar el email");

      // Download .eml
      const emlBlob = new Blob([Uint8Array.from(atob(data.emlBase64), (c) => c.charCodeAt(0))], {
        type: "message/rfc822",
      });
      const url = URL.createObjectURL(emlBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setEmailPrepareStatus("done");
      toastSuccess(`Archivo descargado: ${data.filename}`);
    } catch (err) {
      // Error handled in mutation onError or caught here
      if (!emailMutation.isError) {
        // If error happened outside mutation (e.g. PDF gen or data processing)
        const message = err instanceof Error ? err.message : "Error al preparar el email";
        setErrorLocal(message);
        setEmailPrepareStatus(null);
      }
    }
  }

  // Group months
  const groupedMonths = groupedMonthsMemo();
  function groupedMonthsMemo() {
    const years = [...new Set(months.map((m) => m.split("-")[0] || ""))];
    return years.map((year) => ({
      year,
      months: months.filter((m) => m.startsWith(year)),
    }));
  }

  const pendingCount = bulkRows.filter((row) => !row.entryId && hasRowData(row)).length;
  const modifiedCount = bulkRows.filter((row, index) => isRowDirty(row, initialRows[index])).length;

  const error =
    errorLocal ||
    (summaryError instanceof Error ? summaryError.message : summaryError ? String(summaryError) : null) ||
    (detailError instanceof Error ? detailError.message : detailError ? String(detailError) : null);

  return (
    <section className={PAGE_CONTAINER}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className={TITLE_LG}>Registro de horas y pagos</h1>
          <p className="text-base-content/70 max-w-2xl text-sm">
            Consolida horas trabajadas, extras y montos líquidos.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-52">
            <Input
              label="Trabajador"
              as="select"
              value={selectedEmployeeId ?? ""}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                const value = event.target.value;
                setSelectedEmployeeId(value ? Number(value) : null);
              }}
              disabled={!activeEmployees.length}
              className="bg-base-100"
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
              label="Periodo"
              as="select"
              value={month}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                setMonth(event.target.value);
              }}
              disabled={loadingMonths}
              className="bg-base-100"
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

      {selectedEmployee && (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={() => {
              setEmailModalOpen(true);
              setEmailPrepareStatus(null);
            }}
            disabled={!employeeSummaryRow || !selectedEmployee.person?.email}
            title={
              !selectedEmployee.person?.email
                ? "El empleado no tiene email registrado"
                : "Preparar boleta para enviar por email"
            }
          >
            ✉️ Preparar email
          </Button>
          <Suspense
            fallback={
              <div className="flex items-center gap-2">
                <Button disabled variant="primary" className="bg-primary/70 cursor-wait">
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
            />
          </Suspense>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <TimesheetSummaryTable
        summary={summaryData ? { employees: summaryData.employees, totals: summaryData.totals } : null}
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
          onSalidaBlur={handleSalidaBlur}
          onResetRow={handleResetRow}
          onRemoveEntry={handleRemoveEntry}
          onBulkSave={handleBulkSave}
          saving={upsertMutation.isPending}
          pendingCount={pendingCount}
          modifiedCount={modifiedCount}
          monthLabel={monthLabel}
          employeeOptions={activeEmployees}
        />
      )}

      <EmailPreviewModal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailPrepareStatus(null);
        }}
        onPrepare={handlePrepareEmail}
        prepareStatus={emailPrepareStatus}
        employee={selectedEmployee}
        summary={employeeSummaryRow ?? null}
        month={month}
        monthLabel={monthLabel}
      />
    </section>
  );
}
