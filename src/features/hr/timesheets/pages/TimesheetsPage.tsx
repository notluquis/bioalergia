import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ChangeEvent } from "react";
import dayjs from "dayjs";
import { useToast } from "@/context/ToastContext";
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
import EmailPreviewModal from "@/features/hr/timesheets/components/EmailPreviewModal";
import Alert from "@/components/ui/Alert";
import { useMonths } from "@/features/hr/timesheets/hooks/useMonths";
import { useWakeLock } from "@/hooks/useWakeLock";
import { PAGE_CONTAINER, TITLE_LG } from "@/lib/styles";

const TimesheetExportPDF = lazy(() => import("@/features/hr/timesheets/components/TimesheetExportPDF"));

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

  const { months, monthsWithData, loading: loadingMonths } = useMonths();
  const [month, setMonth] = useState<string>("");
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
  const { success: toastSuccess } = useToast();
  const [saving, setSaving] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  // Estados de preparación: null | 'generating-pdf' | 'preparing' | 'done'
  const [emailPrepareStatus, setEmailPrepareStatus] = useState<string | null>(null);

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

  // Guardar una fila individual inmediatamente (cuando se sale del campo salida)
  const saveRowImmediately = useCallback(
    async (index: number) => {
      if (!selectedEmployeeId || saving) return;

      const row = bulkRows[index];
      const initial = initialRows[index];
      if (!row || !initial) return;

      // Solo guardar si la fila está completa (tiene entrada Y salida) y es dirty
      const isComplete = Boolean(row.entrada?.trim()) && Boolean(row.salida?.trim());
      if (!isComplete || !isRowDirty(row, initial)) return;

      // Validar formato
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

      setSaving(true);
      try {
        await bulkUpsertTimesheets(selectedEmployeeId, [entry], []);
        // Recargar datos silenciosamente
        if (month) {
          const formattedMonth = formatMonthString(month);
          const data = await fetchTimesheetDetail(selectedEmployeeId, formattedMonth);
          const rows = buildBulkRows(formattedMonth, data.entries);
          setBulkRows(rows);
          setInitialRows(rows);
          // Mostrar mensaje breve
          toastSuccess(`Guardado: ${formatDateLabel(row.date)}`);
        }
      } catch {
        // toastError handles errors in the UI if needed, or keeping silence for auto-save retry logic
        console.warn("Auto-save row failed");
      } finally {
        setSaving(false);
      }
    },
    [selectedEmployeeId, saving, bulkRows, initialRows, month, toastSuccess]
  );

  // Handler cuando se sale del campo salida
  const handleSalidaBlur = useCallback(
    (index: number) => {
      // Pequeño delay para permitir que el valor se actualice primero
      setTimeout(() => {
        saveRowImmediately(index);
      }, 100);
    },
    [saveRowImmediately]
  );

  function handleRowChange(index: number, field: keyof Omit<BulkRow, "date" | "entryId">, value: string) {
    setBulkRows((prev) => {
      const currentRow = prev[index];
      if (!currentRow || currentRow[field] === value) return prev;
      return prev.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    });
  }

  function handleResetRow(index: number) {
    setBulkRows((prev) => {
      const next = [...prev];
      const initialRow = initialRows[index];
      if (initialRow) next[index] = { ...initialRow };
      return next;
    });
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
      toastSuccess("Registro eliminado");
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
      toastSuccess("No hay cambios para guardar");
      return;
    }

    setSaving(true);
    try {
      await bulkUpsertTimesheets(selectedEmployeeId, entries, removeIds);
      if (month) {
        await loadSummary(month, selectedEmployeeId);
        await loadDetail(selectedEmployeeId, month);
      }
      toastSuccess("Cambios guardados correctamente");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron guardar los cambios";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  // Función para generar PDF como base64 (usando la misma lógica que TimesheetExportPDF)
  async function generatePdfBase64(): Promise<string | null> {
    if (!selectedEmployee || !employeeSummaryRow) return null;

    try {
      const [{ default: jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = (autoTableModule.default ?? autoTableModule) as typeof autoTableModule.default;
      const doc = new jsPDF();

      // Simplificado: generar PDF básico con los datos
      const margin = 10;

      // Cargar y agregar logo
      try {
        const logoResponse = await fetch("/logo_sin_eslogan.png");
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
        // Logo: 40mm ancho, altura proporcional
        doc.addImage(logoBase64, "PNG", margin, 5, 40, 12);
      } catch {
        // Si falla el logo, continuar sin él
        console.warn("No se pudo cargar el logo para el PDF");
      }

      // Header (ajustado para dejar espacio al logo)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Boleta de Honorarios", margin, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Servicios de ${employeeSummaryRow.role}`, margin, 38);
      doc.text(`Periodo: ${monthLabel}`, margin, 45);

      // Info empleado
      doc.text(`Prestador: ${selectedEmployee.full_name}`, margin, 58);
      doc.text(`RUT: ${selectedEmployee.person?.rut || "-"}`, margin, 65);

      // Tabla resumen
      const fmtCLP = (n: number) =>
        n.toLocaleString("es-CL", { style: "currency", currency: "CLP", minimumFractionDigits: 0 });

      autoTable(doc, {
        head: [["Concepto", "Valor"]],
        body: [
          ["Horas trabajadas", employeeSummaryRow.hoursFormatted],
          ["Horas extras", employeeSummaryRow.overtimeFormatted],
          ["Tarifa por hora", fmtCLP(employeeSummaryRow.hourlyRate)],
          ["Subtotal", fmtCLP(employeeSummaryRow.subtotal)],
          ["Retención", fmtCLP(employeeSummaryRow.retention)],
          ["Total líquido", fmtCLP(employeeSummaryRow.net)],
        ],
        startY: 75,
        theme: "grid",
        styles: { fontSize: 10 },
        headStyles: { fillColor: [14, 100, 183] },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: margin, right: margin },
      });

      // Tabla detalle de días
      const lastTableRef = doc as unknown as { lastAutoTable?: { finalY: number } };
      const nextY = lastTableRef.lastAutoTable ? lastTableRef.lastAutoTable.finalY + 10 : 120;

      const detailBody = bulkRows
        .filter((row) => row.entrada || row.salida)
        .map((row) => [
          dayjs(row.date).format("DD-MM-YYYY"),
          row.entrada || "-",
          row.salida || "-",
          row.overtime || "-",
        ]);

      if (detailBody.length) {
        autoTable(doc, {
          head: [["Fecha", "Entrada", "Salida", "Extras"]],
          body: detailBody,
          startY: nextY,
          theme: "grid",
          styles: { fontSize: 9 },
          headStyles: { fillColor: [241, 167, 34] },
          margin: { left: margin, right: margin },
        });
      }

      // Convertir a base64
      const pdfBlob = doc.output("blob");
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          // Remover el prefijo "data:application/pdf;base64,"
          const base64 = dataUrl.split(",")[1] || "";
          resolve(base64);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(pdfBlob);
      });
    } catch (err) {
      console.error("Error generating PDF:", err);
      return null;
    }
  }

  async function handlePrepareEmail() {
    if (!selectedEmployee || !employeeSummaryRow || !month) return;

    setEmailPrepareStatus("generating-pdf");
    setError(null);

    try {
      // Paso 1: Generar PDF
      const pdfBase64 = await generatePdfBase64();
      if (!pdfBase64) {
        throw new Error("No se pudo generar el PDF");
      }

      // Paso 2: Obtener archivo .eml del servidor
      setEmailPrepareStatus("preparing");
      const response = await fetch("/api/timesheets/prepare-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          month,
          monthLabel,
          pdfBase64,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "ok") {
        throw new Error(data.message || "Error al preparar el email");
      }

      // Paso 3: Descargar el archivo .eml
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

      // Paso 4: Mostrar estado completado
      setEmailPrepareStatus("done");
      toastSuccess(`Archivo descargado: ${data.filename}. Ábrelo con doble click para enviar desde Outlook.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al preparar el email";
      setError(message);
      setEmailPrepareStatus(null);
    }
  }

  // Group months by year for dropdown
  const groupedMonths = useMemo(() => {
    const years = [...new Set(months.map((m) => m.split("-")[0] || ""))];
    return years.map((year) => ({
      year,
      months: months.filter((m) => m.startsWith(year)),
    }));
  }, [months]);

  return (
    <section className={PAGE_CONTAINER}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className={TITLE_LG}>Registro de horas y pagos</h1>
          <p className="text-base-content/70 max-w-2xl text-sm">
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
              }}
              disabled={loadingMonths}
              className="bg-base-100"
            >
              {groupedMonths.map((group) => (
                <optgroup key={group.year} label={group.year}>
                  {group.months.map((m) => {
                    const hasData = monthsWithData.has(m);
                    const label = dayjs(m + "-01").format("MMMM"); // Just month name inside year group, e.g. "Octubre"
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

      {/* Botón de exportar PDF y enviar email */}
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
                <Button
                  type="button"
                  disabled
                  variant="primary"
                  className="bg-primary/70 cursor-wait rounded-xl px-4 py-2 text-sm font-semibold text-white"
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
            />
          </Suspense>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

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
          onSalidaBlur={handleSalidaBlur}
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

      {/* Modal de preview de email */}
      <EmailPreviewModal
        isOpen={emailModalOpen}
        onClose={() => {
          setEmailModalOpen(false);
          setEmailPrepareStatus(null);
        }}
        onPrepare={handlePrepareEmail}
        prepareStatus={emailPrepareStatus}
        employee={selectedEmployee}
        summary={employeeSummaryRow}
        monthLabel={monthLabel}
      />
    </section>
  );
}
