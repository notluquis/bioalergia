import { fmtCLP } from "@/lib/format";
import Button from "@/components/ui/Button";
import type { Employee } from "@/features/hr/employees/types";
import type { TimesheetSummaryRow } from "../types";

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  isSending: boolean;
  employee: Employee | null;
  summary: TimesheetSummaryRow | null;
  monthLabel: string;
}

export default function EmailPreviewModal({
  isOpen,
  onClose,
  onSend,
  isSending,
  employee,
  summary,
  monthLabel,
}: EmailPreviewModalProps) {
  if (!isOpen || !employee || !summary) return null;

  const employeeEmail = employee.person?.email;

  // Calcular monto de horas extras
  const overtimeRate = summary.hourlyRate * 1.5;
  const overtimeAmount = Math.round((summary.overtimeMinutes / 60) * overtimeRate);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-base-100 shadow-2xl">
        {/* Header */}
        <div className="rounded-t-2xl bg-gradient-to-r from-primary to-primary/80 px-6 py-5 text-primary-content">
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

          {/* Preview del email */}
          <div className="rounded-xl border border-base-300 bg-white p-5">
            <p className="mb-4 text-base-content">
              Estimado/a <strong>{employee.full_name}</strong>,
            </p>
            <p className="mb-4 text-sm text-base-content/80">
              A continuación encontrarás el resumen de los servicios prestados durante el periodo{" "}
              <strong>{monthLabel}</strong>:
            </p>

            {/* Tabla resumen */}
            <table className="mb-4 w-full text-sm">
              <tbody className="divide-y divide-base-200">
                <tr>
                  <td className="py-2 text-base-content/70">Función</td>
                  <td className="py-2 text-right font-medium">{summary.role}</td>
                </tr>
                <tr>
                  <td className="py-2 text-base-content/70">Horas trabajadas</td>
                  <td className="py-2 text-right font-medium">{summary.hoursFormatted}</td>
                </tr>
                <tr>
                  <td className="py-2 text-base-content/70">Horas extras</td>
                  <td className="py-2 text-right font-medium">{summary.overtimeFormatted}</td>
                </tr>
                <tr>
                  <td className="py-2 text-base-content/70">Tarifa por hora</td>
                  <td className="py-2 text-right font-medium">{fmtCLP(summary.hourlyRate)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-base-content/70">Monto extras</td>
                  <td className="py-2 text-right font-medium">{fmtCLP(overtimeAmount)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-base-content/70">Subtotal</td>
                  <td className="py-2 text-right font-medium">{fmtCLP(summary.subtotal)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-base-content/70">Retención</td>
                  <td className="py-2 text-right font-medium">{fmtCLP(summary.retention)}</td>
                </tr>
                <tr className="bg-primary/10">
                  <td className="py-3 font-bold text-primary">Total Líquido</td>
                  <td className="py-3 text-right font-bold text-primary">{fmtCLP(summary.net)}</td>
                </tr>
              </tbody>
            </table>

            {/* Fecha de pago */}
            <div className="rounded-lg bg-warning/10 p-3 text-center text-sm">
              <strong className="text-warning-content">📅 Fecha de pago estimada:</strong>{" "}
              <span className="font-medium">{summary.payDate}</span>
            </div>

            {/* Nota de adjunto */}
            <div className="mt-3 rounded-lg bg-info/10 p-3 text-sm text-info-content">
              <strong>📎 Adjunto:</strong> Se incluirá el documento PDF con el detalle completo de horas trabajadas.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-base-300 px-6 py-4">
          <p className="text-xs text-base-content/50">El PDF se generará y adjuntará automáticamente al enviar.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} disabled={isSending}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={onSend} disabled={isSending || !employeeEmail} className="min-w-[120px]">
              {isSending ? (
                <span className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm"></span>
                  Enviando...
                </span>
              ) : (
                "Enviar Email"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
