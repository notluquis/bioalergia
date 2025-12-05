/* eslint-disable no-restricted-syntax -- Email preview uses hardcoded colors to accurately simulate how the actual .eml email will render in email clients */
import { fmtCLP } from "@/lib/format";
import Button from "@/components/ui/Button";
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

  // Calcular monto de horas extras
  const overtimeRate = summary.hourlyRate * 1.5;
  const overtimeAmount = Math.round((summary.overtimeMinutes / 60) * overtimeRate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-base-100 shadow-2xl">
        {/* Header */}
        <div className="rounded-t-2xl bg-linear-to-r from-primary to-primary/80 px-6 py-5 text-primary-content">
          <h2 className="text-xl font-bold">Vista previa del correo</h2>
          <p className="mt-1 text-sm opacity-90">
            Servicios de {summary.role} - {monthLabel}
          </p>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-6">
          {/* Destinatario */}
          <div className="mb-4 rounded-xl bg-base-200/50 p-4">
            <p className="text-sm text-base-content/70">
              <strong>Para:</strong>{" "}
              {employeeEmail ? (
                <span className="font-medium text-base-content">{employeeEmail}</span>
              ) : (
                <span className="text-error">⚠️ Sin email registrado</span>
              )}
            </p>
            <p className="mt-1 text-sm text-base-content/70">
              <strong>Asunto:</strong>{" "}
              <span className="font-medium text-base-content">
                Boleta de Honorarios - {monthLabel} - {employee.full_name}
              </span>
            </p>
          </div>

          {/* Preview del email - simula cómo se verá en el cliente de correo */}
          <div className="rounded-xl border border-base-300 bg-white p-5">
            <p className="mb-4" style={{ color: "#333333" }}>
              Estimado/a <strong>{employee.full_name}</strong>,
            </p>
            <p className="mb-4 text-sm" style={{ color: "#666666" }}>
              A continuación encontrarás el resumen de los servicios prestados durante el periodo{" "}
              <strong style={{ color: "#333333" }}>{monthLabel}</strong>:
            </p>

            {/* Tabla resumen - usar colores explícitos para simular email */}
            <table className="mb-4 w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Función
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {summary.role}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Horas trabajadas
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {summary.hoursFormatted}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Horas extras
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {summary.overtimeFormatted}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Tarifa por hora
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {fmtCLP(summary.hourlyRate)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Monto extras
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {fmtCLP(overtimeAmount)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Subtotal
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {fmtCLP(summary.subtotal)}
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td className="py-2" style={{ color: "#64748b" }}>
                    Retención
                  </td>
                  <td className="py-2 text-right font-medium" style={{ color: "#333333" }}>
                    {fmtCLP(summary.retention)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: "#0e64b7" }}>
                  <td className="py-3 font-bold" style={{ color: "#ffffff" }}>
                    Total Líquido
                  </td>
                  <td className="py-3 text-right font-bold" style={{ color: "#ffffff" }}>
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
              <strong style={{ color: "#92400e" }}>📅 Fecha de pago estimada:</strong>{" "}
              <span className="font-medium" style={{ color: "#78350f" }}>
                {summary.payDate}
              </span>
            </div>

            {/* Nota de adjunto */}
            <div
              className="mt-3 rounded-lg p-3 text-sm"
              style={{ backgroundColor: "#e0f2fe", border: "1px solid #0ea5e9", color: "#0369a1" }}
            >
              <strong>📎 Adjunto:</strong> Se incluirá el documento PDF con el detalle completo de horas trabajadas.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-base-300 px-6 py-4">
          <p className="text-xs text-base-content/50">
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
                  <span className="loading loading-spinner loading-sm"></span>
                  Generando PDF...
                </span>
              ) : prepareStatus === "preparing" ? (
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm"></span>
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
