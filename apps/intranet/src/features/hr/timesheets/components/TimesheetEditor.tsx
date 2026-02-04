import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { lazy, Suspense, useState } from "react";
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
import type {
  BulkRow,
  TimesheetSummaryRow,
  TimesheetUpsertEntry,
} from "@/features/hr/timesheets/types";
import {
  buildBulkRows,
  formatDateLabel,
  hasRowData,
  isRowDirty,
  isValidTimeString,
  parseDuration,
} from "@/features/hr/timesheets/utils";
import { formatISO } from "@/lib/dates";

import type { Employee } from "../../employees/types";

const MONTH_STRING_REGEX = /^\d{4}-\d{2}$/;

const TimesheetExportPDF = lazy(
  () => import("@/features/hr/timesheets/components/TimesheetExportPDF"),
);

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
  // --- Query ---
  const { data: detailData, dataUpdatedAt } = useSuspenseQuery({
    queryFn: () => fetchTimesheetDetail(employeeId, formatMonthString(month)),
    queryKey: ["timesheet-detail", employeeId, month],
  });

  const initialRows = buildBulkRows(formatMonthString(month), detailData.entries);

  return (
    <TimesheetEditorInner
      key={dataUpdatedAt}
      activeEmployees={activeEmployees}
      employeeId={employeeId}
      initialRows={initialRows}
      month={month}
      monthLabel={monthLabel}
      selectedEmployee={selectedEmployee}
      summaryRow={summaryRow}
    />
  );
}

function TimesheetEditorInner({
  activeEmployees,
  employeeId,
  initialRows,
  month,
  monthLabel,
  selectedEmployee,
  summaryRow,
}: TimesheetEditorProps & { initialRows: BulkRow[] }) {
  const queryClient = useQueryClient();
  const { success: toastSuccess } = useToast();

  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => initialRows);
  const [errorLocal, setErrorLocal] = useState<null | string>(null);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPrepareStatus, setEmailPrepareStatus] = useState<null | string>(null);

  // --- Mutations ---

  const upsertMutation = useMutation({
    mutationFn: async (args: {
      employeeId: number;
      entries: TimesheetUpsertEntry[];
      removeIds: number[];
    }) => {
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

  const generatePdfBase64 = () =>
    buildPdfBase64({ bulkRows, monthLabel, selectedEmployee, summaryRow });

  const handlePrepareEmail = createHandlePrepareEmail({
    emailHasError: emailMutation.isError,
    emailMutateAsync: emailMutation.mutateAsync,
    generatePdfBase64,
    month,
    monthLabel,
    selectedEmployee,
    setEmailPrepareStatus,
    setErrorLocal,
    summaryRow,
    toastSuccess,
  });

  const handleRowChange = createHandleRowChange(setBulkRows);
  const handleResetRow = createHandleResetRow(setBulkRows, initialRows);

  const { isPending: isUpsertPending, mutateAsync: upsertMutate } = upsertMutation;

  const saveRowImmediately = createSaveRowImmediately({
    bulkRows,
    employeeId,
    initialRows,
    isUpsertPending,
    toastSuccess,
    upsertMutate,
  });

  const handleSalidaBlur = createHandleSalidaBlur(saveRowImmediately);

  const { mutate: deleteMutate } = deleteMutation;
  const handleRemoveEntry = createHandleRemoveEntry(deleteMutate);

  const handleBulkSave = createHandleBulkSave({
    bulkRows,
    employeeId,
    initialRows,
    setErrorLocal,
    toastSuccess,
    upsertMutate,
  });

  const pendingCount = bulkRows.filter((row) => !row.entryId && hasRowData(row)).length;
  const modifiedCount = bulkRows.filter((row, index) => isRowDirty(row, initialRows[index])).length;

  return (
    <>
      <TimesheetHeaderActions
        bulkRows={bulkRows}
        employeeEmail={selectedEmployee.person?.email ?? null}
        monthLabel={monthLabel}
        onOpenEmailModal={() => {
          setEmailModalOpen(true);
          setEmailPrepareStatus(null);
        }}
        selectedEmployee={selectedEmployee}
        summaryRow={summaryRow}
      />

      {errorLocal && <Alert variant="error">{errorLocal}</Alert>}

      <TimesheetEditorTable
        activeEmployees={activeEmployees}
        bulkRows={bulkRows}
        initialRows={initialRows}
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

      <TimesheetEditorEmailModal
        emailModalOpen={emailModalOpen}
        emailPrepareStatus={emailPrepareStatus}
        month={month}
        monthLabel={monthLabel}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailPrepareStatus(null);
        }}
        onPrepare={handlePrepareEmail}
        selectedEmployee={selectedEmployee}
        summaryRow={summaryRow}
      />
    </>
  );
}

function TimesheetHeaderActions({
  bulkRows,
  employeeEmail,
  monthLabel,
  onOpenEmailModal,
  selectedEmployee,
  summaryRow,
}: {
  bulkRows: BulkRow[];
  employeeEmail: null | string;
  monthLabel: string;
  onOpenEmailModal: () => void;
  selectedEmployee: Employee;
  summaryRow: null | TimesheetSummaryRow;
}) {
  return (
    <div className="mb-4 flex justify-end gap-2">
      <Button
        className="gap-2"
        disabled={!summaryRow || !employeeEmail}
        onClick={onOpenEmailModal}
        title={
          employeeEmail
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
  );
}

function TimesheetEditorTable({
  activeEmployees,
  bulkRows,
  initialRows,
  modifiedCount,
  monthLabel,
  onBulkSave,
  onRemoveEntry,
  onResetRow,
  onRowChange,
  onSalidaBlur,
  pendingCount,
  saving,
  selectedEmployee,
}: {
  activeEmployees: Employee[];
  bulkRows: BulkRow[];
  initialRows: BulkRow[];
  modifiedCount: number;
  monthLabel: string;
  onBulkSave: () => void;
  onRemoveEntry: (row: BulkRow) => void;
  onResetRow: (index: number) => void;
  onRowChange: (
    index: number,
    field: keyof Omit<BulkRow, "date" | "entryId">,
    value: string,
  ) => void;
  onSalidaBlur: (index: number) => void;
  pendingCount: number;
  saving: boolean;
  selectedEmployee: Employee;
}) {
  return (
    <TimesheetDetailTable
      bulkRows={bulkRows}
      employeeOptions={activeEmployees}
      initialRows={initialRows}
      loadingDetail={false}
      modifiedCount={modifiedCount}
      monthLabel={monthLabel}
      onBulkSave={onBulkSave}
      onRemoveEntry={onRemoveEntry}
      onResetRow={onResetRow}
      onRowChange={onRowChange}
      onSalidaBlur={onSalidaBlur}
      pendingCount={pendingCount}
      saving={saving}
      selectedEmployee={selectedEmployee}
    />
  );
}

function TimesheetEditorEmailModal({
  emailModalOpen,
  emailPrepareStatus,
  month,
  monthLabel,
  onClose,
  onPrepare,
  selectedEmployee,
  summaryRow,
}: {
  emailModalOpen: boolean;
  emailPrepareStatus: null | string;
  month: string;
  monthLabel: string;
  onClose: () => void;
  onPrepare: () => void;
  selectedEmployee: Employee;
  summaryRow: null | TimesheetSummaryRow;
}) {
  return (
    <EmailPreviewModal
      employee={selectedEmployee}
      isOpen={emailModalOpen}
      month={month}
      monthLabel={monthLabel}
      onClose={onClose}
      onPrepare={onPrepare}
      prepareStatus={emailPrepareStatus}
      summary={summaryRow ?? null}
    />
  );
}

function buildPdfBase64({
  bulkRows,
  monthLabel,
  selectedEmployee,
  summaryRow,
}: {
  bulkRows: BulkRow[];
  monthLabel: string;
  selectedEmployee: Employee;
  summaryRow: null | TimesheetSummaryRow;
}): Promise<null | string> {
  if (!summaryRow) return Promise.resolve(null);
  return generateTimesheetPdfBase64(selectedEmployee, summaryRow, bulkRows, monthLabel);
}

function createHandlePrepareEmail({
  emailHasError,
  emailMutateAsync,
  generatePdfBase64,
  month,
  monthLabel,
  selectedEmployee,
  setEmailPrepareStatus,
  setErrorLocal,
  summaryRow,
  toastSuccess,
}: {
  emailHasError: boolean;
  emailMutateAsync: (
    args: Parameters<typeof prepareTimesheetEmail>[0],
  ) => Promise<Awaited<ReturnType<typeof prepareTimesheetEmail>>>;
  generatePdfBase64: () => Promise<null | string>;
  month: string;
  monthLabel: string;
  selectedEmployee: Employee;
  setEmailPrepareStatus: (value: null | string) => void;
  setErrorLocal: (value: null | string) => void;
  summaryRow: null | TimesheetSummaryRow;
  toastSuccess: (message: string) => void;
}) {
  return async () => {
    if (!summaryRow || !month) return;
    setEmailPrepareStatus("generating-pdf");
    setErrorLocal(null);

    try {
      const filename = await runPrepareEmail({
        emailMutateAsync,
        generatePdfBase64,
        month,
        monthLabel,
        selectedEmployee,
        setEmailPrepareStatus,
        summaryRow,
      });
      setEmailPrepareStatus("done");
      toastSuccess(`Archivo descargado: ${filename}`);
    } catch (error_) {
      if (!emailHasError) {
        const message = error_ instanceof Error ? error_.message : "Error al preparar el email";
        setErrorLocal(message);
        setEmailPrepareStatus(null);
      }
    }
  };
}

async function runPrepareEmail({
  emailMutateAsync,
  generatePdfBase64,
  month,
  monthLabel,
  selectedEmployee,
  setEmailPrepareStatus,
  summaryRow,
}: {
  emailMutateAsync: (
    args: Parameters<typeof prepareTimesheetEmail>[0],
  ) => Promise<Awaited<ReturnType<typeof prepareTimesheetEmail>>>;
  generatePdfBase64: () => Promise<null | string>;
  month: string;
  monthLabel: string;
  selectedEmployee: Employee;
  setEmailPrepareStatus: (value: null | string) => void;
  summaryRow: TimesheetSummaryRow;
}) {
  const pdfBase64 = await generatePdfBase64();
  if (!pdfBase64) throw new Error("No se pudo generar el PDF");

  setEmailPrepareStatus("preparing");

  const payload = buildPrepareEmailPayload({
    month,
    monthLabel,
    pdfBase64,
    selectedEmployee,
    summaryRow,
  });

  const data = await emailMutateAsync(payload);
  ensurePrepareEmailSuccess(data);
  downloadEmlFile(data.emlBase64, data.filename);
  return data.filename;
}

function buildPrepareEmailPayload({
  month,
  monthLabel,
  pdfBase64,
  selectedEmployee,
  summaryRow,
}: {
  month: string;
  monthLabel: string;
  pdfBase64: string;
  selectedEmployee: Employee;
  summaryRow: TimesheetSummaryRow;
}) {
  return {
    employeeEmail: selectedEmployee.person?.email ?? "",
    employeeId: selectedEmployee.id,
    employeeName: selectedEmployee.full_name,
    month,
    monthLabel,
    pdfBase64,
    summary: buildEmailSummary(summaryRow),
  };
}

function buildEmailSummary(summaryRow: TimesheetSummaryRow) {
  return {
    net: summaryRow.net,
    overtimeMinutes: summaryRow.overtimeMinutes,
    payDate: formatISO(summaryRow.payDate),
    retention: summaryRow.retention,
    retention_rate: summaryRow.retention_rate,
    retentionRate: summaryRow.retentionRate,
    role: summaryRow.role,
    subtotal: summaryRow.subtotal,
    workedMinutes: summaryRow.workedMinutes,
  };
}

function ensurePrepareEmailSuccess(data: Awaited<ReturnType<typeof prepareTimesheetEmail>>) {
  if (data.status !== "ok") {
    throw new Error(data.message || "Error al preparar el email");
  }
}

function downloadEmlFile(emlBase64: string, filename: string) {
  const emlBlob = new Blob([Uint8Array.from(atob(emlBase64), (c) => c.codePointAt(0) ?? 0)], {
    type: "message/rfc822",
  });
  const url = URL.createObjectURL(emlBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createHandleRowChange(
  setBulkRows: (rows: BulkRow[] | ((prev: BulkRow[]) => BulkRow[])) => void,
) {
  return (index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) => {
    setBulkRows((prev) => {
      const currentRow = prev[index];
      if (!currentRow || currentRow[field] === value) return prev;
      return prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    });
  };
}

function createHandleResetRow(
  setBulkRows: (rows: BulkRow[] | ((prev: BulkRow[]) => BulkRow[])) => void,
  initialRows: BulkRow[],
) {
  return (index: number) => {
    setBulkRows((prev) => {
      const next = [...prev];
      const initialRow = initialRows[index];
      if (initialRow) next[index] = { ...initialRow };
      return next;
    });
  };
}

function isRowReadyForImmediateSave(row: BulkRow, initial: BulkRow) {
  if (!isRowDirty(row, initial)) return false;
  if (!hasRequiredTimes(row)) return false;
  if (!hasValidTimes(row)) return false;
  return parseDuration(row.overtime) !== null;
}

function hasRequiredTimes(row: BulkRow) {
  return Boolean(row.entrada?.trim()) && Boolean(row.salida?.trim());
}

function hasValidTimes(row: BulkRow) {
  const entradaOk = !row.entrada || isValidTimeString(row.entrada);
  const salidaOk = !row.salida || isValidTimeString(row.salida);
  return entradaOk && salidaOk;
}

function buildImmediateSaveEntry(row: BulkRow): null | TimesheetUpsertEntry {
  const overtime = parseDuration(row.overtime);
  if (overtime === null) return null;

  const comment = row.comment.trim() || null;
  return {
    comment,
    end_time: row.salida || null,
    extra_amount: 0,
    overtime_minutes: overtime,
    start_time: row.entrada || null,
    work_date: row.date,
  };
}

function createSaveRowImmediately({
  bulkRows,
  employeeId,
  initialRows,
  isUpsertPending,
  toastSuccess,
  upsertMutate,
}: {
  bulkRows: BulkRow[];
  employeeId: number;
  initialRows: BulkRow[];
  isUpsertPending: boolean;
  toastSuccess: (message: string) => void;
  upsertMutate: (args: {
    employeeId: number;
    entries: TimesheetUpsertEntry[];
    removeIds: number[];
  }) => Promise<unknown>;
}) {
  return async (index: number) => {
    if (isUpsertPending) return;
    const row = bulkRows[index];
    const initial = initialRows[index];
    if (!row || !initial) return;

    if (!isRowReadyForImmediateSave(row, initial)) return;
    const entry = buildImmediateSaveEntry(row);
    if (!entry) return;

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
}

function createHandleSalidaBlur(saveRowImmediately: (index: number) => Promise<void>) {
  return (index: number) => {
    setTimeout(() => {
      void saveRowImmediately(index);
    }, 100);
  };
}

function createHandleRemoveEntry(deleteMutate: (entryId: number) => void) {
  return (row: BulkRow) => {
    if (!row.entryId) return;
    if (!confirm("¿Eliminar el registro de este día?")) return;
    deleteMutate(row.entryId);
  };
}

function processBulkRow(
  row: BulkRow,
  initial: BulkRow,
): { entry?: TimesheetUpsertEntry; error?: string; removeId?: number } {
  if (!isRowDirty(row, initial)) return {};

  const validationError = validateBulkRow(row);
  if (validationError) return { error: validationError };

  const overtime = parseDuration(row.overtime);
  if (overtime === null) {
    return { error: `Horas extra inválidas en ${formatDateLabel(row.date)}` };
  }

  const { entrada, salida, comment: rawComment, entryId } = row;
  const comment = rawComment.trim() || null;
  const hasContent = Boolean(entrada) || Boolean(salida) || overtime > 0 || Boolean(comment);

  if (!hasContent) {
    return entryId ? { removeId: entryId } : {};
  }

  return {
    entry: {
      comment,
      // Always send local time in HH:MM (America/Santiago policy handled server-side)
      end_time: salida || null,
      extra_amount: 0,
      overtime_minutes: overtime,
      start_time: entrada || null,
      work_date: row.date,
    },
  };
}

function collectBulkChanges(bulkRows: BulkRow[], initialRows: BulkRow[]) {
  const entries: TimesheetUpsertEntry[] = [];
  const removeIds: number[] = [];

  for (const [index, row] of bulkRows.entries()) {
    const initial = initialRows[index];
    if (!initial) continue;
    const result = processBulkRow(row, initial);
    if (result.error) {
      return { entries, removeIds, error: result.error };
    }
    if (result.entry) entries.push(result.entry);
    if (result.removeId) removeIds.push(result.removeId);
  }

  return { entries, removeIds, error: null };
}

function createHandleBulkSave({
  bulkRows,
  employeeId,
  initialRows,
  setErrorLocal,
  toastSuccess,
  upsertMutate,
}: {
  bulkRows: BulkRow[];
  employeeId: number;
  initialRows: BulkRow[];
  setErrorLocal: (value: null | string) => void;
  toastSuccess: (message: string) => void;
  upsertMutate: (args: {
    employeeId: number;
    entries: TimesheetUpsertEntry[];
    removeIds: number[];
  }) => Promise<unknown>;
}) {
  return async () => {
    setErrorLocal(null);

    const { entries, removeIds, error } = collectBulkChanges(bulkRows, initialRows);
    if (error) {
      setErrorLocal(error);
      return;
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
}

// Utility to ensure month is always YYYY-MM
function formatMonthString(m: string): string {
  if (MONTH_STRING_REGEX.test(m)) return m;
  const d = dayjs(m, ["YYYY-MM", "YYYY/MM", "MM/YYYY", "YYYY-MM-DD", "DD/MM/YYYY"]);
  if (d.isValid()) return d.format("YYYY-MM");
  return dayjs().format("YYYY-MM");
}

function validateBulkRow(row: BulkRow): string | null {
  if (row.entrada && !isValidTimeString(row.entrada)) {
    return `Hora de entrada inválida en ${formatDateLabel(row.date)}`;
  }
  if (row.salida && !isValidTimeString(row.salida)) {
    return `Hora de salida inválida en ${formatDateLabel(row.date)}`;
  }
  return null;
}
