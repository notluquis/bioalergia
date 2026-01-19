import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { lazy, Suspense, useEffect, useState } from "react";

import type { BulkRow, TimesheetSummaryRow, TimesheetUpsertEntry } from "@/features/hr/timesheets/types";

import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { useToast } from "@/context/ToastContext";
import {
  bulkUpsertTimesheets,
  deleteTimesheet,
  fetchTimesheetDetail,
  prepareTimesheetEmail,
} from "@/features/hr/timesheets/api";
import EmailPreviewModal from "@/features/hr/timesheets/components/EmailPreviewModal";
import TimesheetDetailTable from "@/features/hr/timesheets/components/TimesheetDetailTable";
import { generateTimesheetPdfBase64 } from "@/features/hr/timesheets/pdf-utils";
import { buildBulkRows, formatDateLabel, hasRowData, isRowDirty, parseDuration } from "@/features/hr/timesheets/utils";

import type { Employee } from "../../employees/types";

const TimesheetExportPDF = lazy(() => import("@/features/hr/timesheets/components/TimesheetExportPDF"));

interface TimesheetEditorProps {
  readonly activeEmployees: Employee[];
  readonly employeeId: number;
  readonly month: string; // YYYY-MM
  readonly monthLabel: string;
  readonly selectedEmployee: Employee;
  readonly summaryRow: null | TimesheetSummaryRow;
}

export default function TimesheetEditor({
  activeEmployees,
  employeeId,
  month,
  monthLabel,
  selectedEmployee,
  summaryRow,
}: TimesheetEditorProps) {
  const queryClient = useQueryClient();
  const { success: toastSuccess } = useToast();

  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [initialRows, setInitialRows] = useState<BulkRow[]>([]);
  const [errorLocal, setErrorLocal] = useState<null | string>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPrepareStatus, setEmailPrepareStatus] = useState<null | string>(null);

  // --- Query ---
  const { data: detailData } = useSuspenseQuery({
    queryFn: () => fetchTimesheetDetail(employeeId, formatMonthString(month)),
    queryKey: ["timesheet-detail", employeeId, month],
  });

  // --- Sync State ---
  useEffect(() => {
    const rows = buildBulkRows(formatMonthString(month), detailData.entries);
    setBulkRows(rows);
    setInitialRows(rows);
    setErrorLocal(null);
  }, [detailData, month]);

  // --- Mutations ---

  const upsertMutation = useMutation({
    mutationFn: async (args: { employeeId: number; entries: TimesheetUpsertEntry[]; removeIds: number[] }) => {
      return bulkUpsertTimesheets(args.employeeId, args.entries, args.removeIds);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al guardar";
      setErrorLocal(message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["timesheet-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["timesheet-summary"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      return deleteTimesheet(entryId);
    },
    onError: (err) => {
      setErrorLocal(err instanceof Error ? err.message : "Error al eliminar");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["timesheet-detail"] });
      void queryClient.invalidateQueries({ queryKey: ["timesheet-summary"] });
      toastSuccess("Registro eliminado");
    },
  });

  // Email Mutation
  const emailMutation = useMutation({
    mutationFn: prepareTimesheetEmail,
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Error al preparar el email";
      setErrorLocal(message);
      setEmailPrepareStatus(null);
    },
  });

  // --- Handlers ---

  const generatePdfBase64 = async (): Promise<null | string> => {
    if (!summaryRow) return null;
    return generateTimesheetPdfBase64(selectedEmployee, summaryRow, bulkRows, monthLabel);
  };

  async function handlePrepareEmail() {
    if (!summaryRow || !month) return;
    setEmailPrepareStatus("generating-pdf");
    setErrorLocal(null);

    try {
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) throw new Error("No se pudo generar el PDF");

      setEmailPrepareStatus("preparing");

      const data = await emailMutation.mutateAsync({
        employeeEmail: selectedEmployee.person?.email ?? "",
        employeeId: selectedEmployee.id,
        employeeName: selectedEmployee.full_name,
        month,
        monthLabel,
        pdfBase64,
        summary: {
          net: summaryRow.net,
          overtimeMinutes: summaryRow.overtimeMinutes,
          payDate: summaryRow.payDate,
          retention: summaryRow.retention,
          retention_rate: (summaryRow as unknown as Record<string, unknown>).retention_rate as
            | null
            | number
            | undefined, // Legacy support workaround
          retentionRate: summaryRow.retentionRate,
          role: summaryRow.role,
          subtotal: summaryRow.subtotal,
          workedMinutes: summaryRow.workedMinutes,
        },
      });

      if (data.status !== "ok") throw new Error(data.message || "Error al preparar el email");

      // Download .eml
      const emlBlob = new Blob([Uint8Array.from(atob(data.emlBase64), (c) => c.codePointAt(0) ?? 0)], {
        type: "message/rfc822",
      });
      const url = URL.createObjectURL(emlBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setEmailPrepareStatus("done");
      toastSuccess(`Archivo descargado: ${data.filename}`);
    } catch (error_) {
      if (!emailMutation.isError) {
        const message = error_ instanceof Error ? error_.message : "Error al preparar el email";
        setErrorLocal(message);
        setEmailPrepareStatus(null);
      }
    }
  }

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

  const { isPending: isUpsertPending, mutateAsync: upsertMutate } = upsertMutation;

  const saveRowImmediately = async (index: number) => {
    if (isUpsertPending) return;
    const row = bulkRows[index];
    const initial = initialRows[index];
    if (!row || !initial) return;

    const isComplete = Boolean(row.entrada?.trim()) && Boolean(row.salida?.trim());
    if (!isComplete || !isRowDirty(row, initial)) return;

    if (row.entrada && !/^\d{1,2}:\d{2}$/.test(row.entrada)) return;
    if (row.salida && !/^\d{1,2}:\d{2}$/.test(row.salida)) return;

    const overtime = parseDuration(row.overtime);
    if (overtime === null) return;

    const comment = row.comment.trim() || null;
    const entry = {
      comment,
      end_time: row.salida || null,
      extra_amount: 0,
      overtime_minutes: overtime,
      start_time: row.entrada || null,
      work_date: row.date,
    };

    try {
      await upsertMutate({
        employeeId,
        entries: [entry],
        removeIds: [],
      });
      toastSuccess(`Guardado: ${formatDateLabel(row.date)}`);
    } catch {
      // Handled in mutation
    }
  };

  const handleSalidaBlur = (index: number) => {
    setTimeout(() => {
      void saveRowImmediately(index);
    }, 100);
  };

  const { mutate: deleteMutate } = deleteMutation;

  const handleRemoveEntry = (row: BulkRow) => {
    if (!row.entryId) return;
    if (!confirm("¿Eliminar el registro de este día?")) return;
    deleteMutate(row.entryId);
  };

  const processBulkRow = (
    row: BulkRow,
    initial: BulkRow
  ): { entry?: TimesheetUpsertEntry; error?: string; removeId?: number } => {
    if (!isRowDirty(row, initial)) return {};

    if (row.entrada && !/^\d{1,2}:\d{2}$/.test(row.entrada)) {
      return { error: `Hora de entrada inválida en ${formatDateLabel(row.date)}` };
    }
    if (row.salida && !/^\d{1,2}:\d{2}$/.test(row.salida)) {
      return { error: `Hora de salida inválida en ${formatDateLabel(row.date)}` };
    }

    const overtime = parseDuration(row.overtime);
    if (overtime === null) {
      return { error: `Horas extra inválidas en ${formatDateLabel(row.date)}` };
    }

    const comment = row.comment.trim() || null;
    const hasContent = Boolean(row.entrada) || Boolean(row.salida) || overtime > 0 || Boolean(comment);

    if (!hasContent && row.entryId) {
      return { removeId: row.entryId };
    }

    if (!hasContent) return {};

    return {
      entry: {
        comment,
        end_time: row.salida ? dayjs(`${row.date} ${row.salida}`).toISOString() : null,
        extra_amount: 0,
        overtime_minutes: overtime,
        start_time: row.entrada ? dayjs(`${row.date} ${row.entrada}`).toISOString() : null,
        work_date: row.date,
      },
    };
  };

  const handleBulkSave = async () => {
    setErrorLocal(null);

    const entries: TimesheetUpsertEntry[] = [];
    const removeIds: number[] = [];

    for (const [index, row] of bulkRows.entries()) {
      const initial = initialRows[index];
      if (!initial) continue;
      const result = processBulkRow(row, initial);
      if (result.error) {
        setErrorLocal(result.error);
        return;
      }
      if (result.entry) entries.push(result.entry);
      if (result.removeId) removeIds.push(result.removeId);
    }

    if (entries.length === 0 && removeIds.length === 0) {
      toastSuccess("No hay cambios para guardar");
      return;
    }

    try {
      await upsertMutate({
        employeeId,
        entries,
        removeIds,
      });
      toastSuccess("Cambios guardados correctamente");
    } catch {
      // Handled in mutation
    }
  };

  const pendingCount = bulkRows.filter((row) => !row.entryId && hasRowData(row)).length;
  const modifiedCount = bulkRows.filter((row, index) => isRowDirty(row, initialRows[index])).length;

  return (
    <>
      <div className="mb-4 flex justify-end gap-2">
        <Button
          className="gap-2"
          disabled={!summaryRow || !selectedEmployee.person?.email}
          onClick={() => {
            setEmailModalOpen(true);
            setEmailPrepareStatus(null);
          }}
          title={
            selectedEmployee.person?.email
              ? "Preparar boleta para enviar por email"
              : "El empleado no tiene email registrado"
          }
          type="button"
          variant="secondary"
        >
          ✉️ Preparar email
        </Button>
        <Suspense
          fallback={
            <div className="flex items-center gap-2">
              <Button className="bg-primary/70 cursor-wait" disabled variant="primary">
                Cargando exportador...
              </Button>
            </div>
          }
        >
          <TimesheetExportPDF
            bulkRows={bulkRows}
            columns={["date", "entrada", "salida", "worked", "overtime"]}
            employee={selectedEmployee}
            logoUrl={"/logo.png"}
            monthLabel={monthLabel}
            summary={summaryRow || null}
          />
        </Suspense>
      </div>

      {errorLocal && <Alert variant="error">{errorLocal}</Alert>}

      <TimesheetDetailTable
        bulkRows={bulkRows}
        employeeOptions={activeEmployees}
        initialRows={initialRows}
        loadingDetail={false}
        modifiedCount={modifiedCount}
        monthLabel={monthLabel}
        onBulkSave={handleBulkSave}
        onRemoveEntry={handleRemoveEntry}
        onResetRow={handleResetRow}
        onRowChange={handleRowChange}
        onSalidaBlur={handleSalidaBlur}
        pendingCount={pendingCount}
        saving={upsertMutation.isPending}
        selectedEmployee={selectedEmployee}
      />

      <EmailPreviewModal
        employee={selectedEmployee}
        isOpen={emailModalOpen}
        month={month}
        monthLabel={monthLabel}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailPrepareStatus(null);
        }}
        onPrepare={handlePrepareEmail}
        prepareStatus={emailPrepareStatus}
        summary={summaryRow ?? null}
      />
    </>
  );
}

// Utility to ensure month is always YYYY-MM
function formatMonthString(m: string): string {
  if (/^\d{4}-\d{2}$/.test(m)) return m;
  const d = dayjs(m, ["YYYY-MM", "YYYY/MM", "MM/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]);
  if (d.isValid()) return d.format("YYYY-MM");
  return dayjs().format("YYYY-MM");
}
