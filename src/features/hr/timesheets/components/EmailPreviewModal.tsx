/* eslint-disable no-restricted-syntax -- Email preview uses hardcoded colors to accurately simulate how the actual .eml email will render in email clients */
import { fmtCLP } from "@/lib/format";
import dayjs from "dayjs";
import "dayjs/locale/es";
import Button from "@/components/ui/Button";
import { LOADING_SPINNER_SM } from "@/lib/styles";
import type { Employee } from "@/features/hr/employees/types";
import type { TimesheetSummaryRow } from "../types";

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrepare: () => void;
  prepareStatus: string | null; // null | 'generating-pdf' | 'preparing' | 'done'
  employee: Employee | null;
  summary: TimesheetSummaryRow | null;
  monthLabel: string;
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onPrepare,
  prepareStatus,
  employee,
  summary,
  monthLabel,
}: EmailPreviewModalProps) {
  const isPreparing = prepareStatus !== null && prepareStatus !== "done";
  if (!isOpen || !employee || !summary) return null;

  const employeeEmail = employee.person?.email;

  // Convertir mes a español
  dayjs.locale("es");
  let monthLabelEs = monthLabel;
  const monthMatch = monthLabel.match(/^(\d{4})-(\d{2})$/);
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
  const retentionPercent = ((summary.retentionRate || 0.145) * 100).toFixed(1).replace(".", ",");

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
          <div className="border-base-300 rounded-xl border bg-white p-5">
            <p className="mb-4" style={{ color: "#333333" }}>
              Estimado/a <strong>{employee.full_name}</strong>,
            </p>
            <p className="mb-4 text-sm" style={{ color: "#333333" }}>
              A continuación encontrarás el resumen de los servicios prestados durante el periodo{" "}
              <strong>{monthLabelEs}</strong>, favor corroborar y emitir boleta de honorarios.
            </p>

            {/* Caja verde para la boleta */}
            <div className="mb-4 rounded-lg p-4" style={{ backgroundColor: "#dcfce7", border: "2px solid #22c55e" }}>
              <p className="mb-3 text-xs font-semibold tracking-wider uppercase" style={{ color: "#166534" }}>
                📝 Para la boleta de honorarios
              </p>
              <div className="space-y-2">
                <div>
                  <p className="mb-1 text-xs" style={{ color: "#166534" }}>
                    Descripción:
                  </p>
                  <p className="font-mono text-sm font-bold" style={{ color: "#166534" }}>
                    {boletaDescription}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs" style={{ color: "#166534" }}>
                    Monto Bruto:
                  </p>
                  <p className="font-mono text-xl font-bold" style={{ color: "#166534" }}>
                    {fmtCLP(summary.subtotal)}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabla resumen */}
            <table className="mb-4 w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f1f5f9" }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: "#475569" }}>
                    Concepto
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase" style={{ color: "#475569" }}>
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="px-3 py-3" style={{ color: "#333333" }}>
                    Horas totales
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: "#333333" }}>
                    {totalHoursFormatted}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="px-3 py-3" style={{ color: "#333333" }}>
                    Monto Bruto
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: "#333333" }}>
                    {fmtCLP(summary.subtotal)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="px-3 py-3" style={{ color: "#333333" }}>
                    Retención ({retentionPercent}%)
                  </td>
                  <td className="px-3 py-3 text-right font-mono" style={{ color: "#333333" }}>
                    -{fmtCLP(summary.retention)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#0e64b7" }}>
                  <td className="px-3 py-3 font-bold" style={{ color: "#ffffff" }}>
                    Total Líquido
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#ffffff" }}>
                    {fmtCLP(summary.net)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Fecha de pago */}
            <div
              className="rounded-lg p-3 text-center text-sm"
              style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b" }}
            >
              <strong style={{ color: "#92400e" }}>📅 Fecha de pago estimada: {summary.payDate}</strong>
            </div>

            {/* Nota de adjunto */}
            <div
              className="mt-3 rounded-lg p-3 text-sm"
              style={{ backgroundColor: "#e0f2fe", border: "1px solid #0ea5e9", color: "#0369a1" }}
            >
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
              {prepareStatus === "generating-pdf" ? (
                <span className="flex items-center gap-2">
                  <span className={LOADING_SPINNER_SM}></span>
                  Generando PDF...
                </span>
              ) : prepareStatus === "preparing" ? (
                <span className="flex items-center gap-2">
                  <span className={LOADING_SPINNER_SM}></span>
                  Preparando...
                </span>
              ) : prepareStatus === "done" ? (
                <span className="flex items-center gap-2">
                  <span>📧</span>
                  Descargado
                </span>
              ) : (
                "Preparar Email"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
