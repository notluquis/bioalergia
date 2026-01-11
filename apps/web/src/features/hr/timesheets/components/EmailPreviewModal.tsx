import "dayjs/locale/es";

import { formatRetentionPercent, getEffectiveRetentionRate } from "@shared/retention";
import dayjs from "dayjs";

import Button from "@/components/ui/Button";
import type { Employee } from "@/features/hr/employees/types";
import { fmtCLP } from "@/lib/format";
import { LOADING_SPINNER_SM } from "@/lib/styles";

import type { TimesheetSummaryRow } from "../types";

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrepare: () => void;
  prepareStatus: string | null; // null | 'generating-pdf' | 'preparing' | 'done'
  employee: Employee | null;
  summary: TimesheetSummaryRow | null;
  month: string; // YYYY-MM format
  monthLabel: string;
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onPrepare,
  prepareStatus,
  employee,
  summary,
  month,
  monthLabel,
}: EmailPreviewModalProps) {
  const isPreparing = prepareStatus !== null && prepareStatus !== "done";
  if (!isOpen || !employee || !summary) return null;

  const employeeEmail = employee.person?.email;

  // Convertir mes a español
  dayjs.locale("es");
  let monthLabelEs = monthLabel;
  const monthRegex = /^(\d{4})-(\d{2})$/;
  const monthMatch = monthRegex.exec(monthLabel);
  if (monthMatch) {
    monthLabelEs = dayjs(`${monthMatch[1]}-${monthMatch[2]}-01`).locale("es").format("MMMM YYYY");
  } else if (dayjs(monthLabel, "MMMM YYYY", "en").isValid()) {
    monthLabelEs = dayjs(monthLabel, "MMMM YYYY", "en").locale("es").format("MMMM YYYY");
  }
  monthLabelEs = monthLabelEs.charAt(0).toUpperCase() + monthLabelEs.slice(1);

  // Usar datos ya calculados del backend - no recalcular
  const totalMinutes = (summary.workedMinutes || 0) + (summary.overtimeMinutes || 0);
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;

  const boletaDescription = `SERVICIOS DE ${summary.role.toUpperCase()} ${totalHoursFormatted} HORAS`;

  // Get year from month in YYYY-MM format
  const summaryYear = month ? Number.parseInt(month.split("-")[0]!, 10) : new Date().getFullYear();
  // Handle both camelCase and snake_case from backend
  const summaryData = summary as unknown as Record<string, unknown>;
  const employeeRate =
    (summaryData.retentionRate as number | null) || (summaryData.retention_rate as number | null) || null;
  const effectiveRate = getEffectiveRetentionRate(employeeRate, summaryYear);
  const retentionPercent = formatRetentionPercent(effectiveRate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-base-100 w-full max-w-2xl rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="from-primary to-primary/80 text-primary-content rounded-t-2xl bg-linear-to-r px-6 py-5">
          <h2 className="text-xl font-bold">Vista previa del correo</h2>
          <p className="mt-1 text-sm opacity-90">
            Servicios de {summary.role} - {monthLabelEs}
          </p>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Destinatario */}
          <div className="bg-base-200/50 mb-4 rounded-xl p-4">
            <p className="text-base-content/70 text-sm">
              <strong>Para:</strong>{" "}
              {employeeEmail ? (
                <span className="text-base-content font-medium">{employeeEmail}</span>
              ) : (
                <span className="text-error">⚠️ Sin email registrado</span>
              )}
            </p>
            <p className="text-base-content/70 mt-1 text-sm">
              <strong>Asunto:</strong>{" "}
              <span className="text-base-content font-medium">
                Boleta de Honorarios - {monthLabelEs} - {employee.full_name}
              </span>
            </p>
          </div>

          {/* Preview del email - simula cómo se verá en el cliente de correo */}
          <div className="border-base-300 bg-base-100 rounded-xl border p-5">
            <p className="text-base-content mb-4">
              Estimado/a <strong>{employee.full_name}</strong>,
            </p>
            <p className="text-base-content mb-4 text-sm">
              A continuación encontrarás el resumen de los servicios prestados durante el periodo{" "}
              <strong>{monthLabelEs}</strong>, favor corroborar y emitir boleta de honorarios.
            </p>

            {/* Caja verde para la boleta */}
            <div className="mb-4 rounded-lg border-2 border-green-500 bg-green-100 p-4">
              <p className="mb-3 text-xs font-semibold tracking-wider text-green-800 uppercase">
                📝 Para la boleta de honorarios
              </p>
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-xs text-green-800">Descripción:</p>
                  <p className="font-mono text-sm font-bold text-green-800">{boletaDescription}</p>
                </div>
                <div>
                  <p className="mb-1 text-xs text-green-800">Monto Bruto:</p>
                  <p className="font-mono text-xl font-bold text-green-800">{fmtCLP(summary.subtotal)}</p>
                </div>
              </div>
            </div>

            {/* Tabla resumen */}
            <table className="mb-4 w-full border-collapse text-sm">
              <thead>
                <tr className="bg-base-200">
                  <th className="text-base-content/70 px-3 py-2 text-left text-xs font-semibold uppercase">Concepto</th>
                  <th className="text-base-content/70 px-3 py-2 text-right text-xs font-semibold uppercase">Detalle</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-base-300 border-b">
                  <td className="text-base-content px-3 py-3">Horas totales</td>
                  <td className="text-base-content px-3 py-3 text-right font-mono">{totalHoursFormatted}</td>
                </tr>
                <tr className="border-base-300 border-b">
                  <td className="text-base-content px-3 py-3">Monto Bruto</td>
                  <td className="text-base-content px-3 py-3 text-right font-mono">{fmtCLP(summary.subtotal)}</td>
                </tr>
                <tr className="border-base-300 border-b">
                  <td className="text-base-content px-3 py-3">Retención ({retentionPercent})</td>
                  <td className="text-base-content px-3 py-3 text-right font-mono">-{fmtCLP(summary.retention)}</td>
                </tr>
                <tr className="bg-blue-700">
                  <td className="px-3 py-3 font-bold text-white">Total Líquido</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-white">{fmtCLP(summary.net)}</td>
                </tr>
              </tbody>
            </table>

            {/* Fecha de pago */}
            <div className="rounded-lg border border-amber-500 bg-amber-100 p-3 text-center text-sm">
              <strong className="text-amber-800">📅 Fecha de pago estimada: {summary.payDate}</strong>
            </div>

            {/* Nota de adjunto */}
            <div className="mt-3 rounded-lg border border-sky-500 bg-sky-100 p-3 text-sm text-sky-700">
              <strong>📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo de horas trabajadas.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-base-300 flex items-center justify-between border-t px-6 py-4">
          <p className="text-base-content/50 text-xs">
            {prepareStatus === "generating-pdf" && "Generando documento PDF..."}
            {prepareStatus === "preparing" && "Preparando archivo de email..."}
            {prepareStatus === "done" && "✅ Archivo descargado - Ábrelo con doble click y presiona Enviar"}
            {!prepareStatus && "Se descargará un archivo .eml que puedes abrir con Outlook."}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isPreparing}>
              {prepareStatus === "done" ? "Cerrar" : "Cancelar"}
            </Button>
            <Button
              variant="primary"
              onClick={onPrepare}
              disabled={isPreparing || !employeeEmail || prepareStatus === "done"}
              className="min-w-44"
            >
              {(() => {
                if (prepareStatus === "generating-pdf") {
                  return (
                    <span className="flex items-center gap-2">
                      <span className={LOADING_SPINNER_SM}></span>
                      Generando PDF...
                    </span>
                  );
                }
                if (prepareStatus === "preparing") {
                  return (
                    <span className="flex items-center gap-2">
                      <span className={LOADING_SPINNER_SM}></span>
                      Preparando...
                    </span>
                  );
                }
                if (prepareStatus === "done") {
                  return (
                    <span className="flex items-center gap-2">
                      <span>📧</span>
                      Descargado
                    </span>
                  );
                }
                return <>Preparar Email</>;
              })()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
