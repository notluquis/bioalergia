import {
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalRoot,
  Spinner,
} from "@heroui/react";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Employee } from "@/features/hr/employees/types";
import { fmtCLP } from "@/lib/format";
import { formatRetentionPercent, getEffectiveRetentionRate } from "~/shared/retention";

import type { TimesheetSummaryRow } from "../types";

import "dayjs/locale/es";

const MONTH_LABEL_REGEX = /^(\d{4})-(\d{2})$/;

interface EmailPreviewModalProps {
  employee: Employee | null;
  isOpen: boolean;
  month: string; // YYYY-MM format
  monthLabel: string;
  onClose: () => void;
  onPrepare: () => void;
  prepareStatus: null | string; // null | 'generating-pdf' | 'preparing-payload' | 'sending' | 'done'
  summary: null | TimesheetSummaryRow;
}

const LOCAL_AGENT_TOKEN_KEY = "bioalergia_local_mail_agent_token";
const LOCAL_AGENT_URL_KEY = "bioalergia_local_mail_agent_url";
const DEFAULT_LOCAL_AGENT_URL =
  import.meta.env.VITE_LOCAL_MAIL_AGENT_URL ?? "http://127.0.0.1:3333";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy component
export function EmailPreviewModal({
  employee,
  isOpen,
  month,
  monthLabel,
  onClose,
  onPrepare,
  prepareStatus,
  summary,
}: EmailPreviewModalProps) {
  const isPreparing = prepareStatus !== null && prepareStatus !== "done";
  const [agentToken, setAgentToken] = useState("");
  const [agentUrl, setAgentUrl] = useState(DEFAULT_LOCAL_AGENT_URL);
  const [agentStatus, setAgentStatus] = useState<null | string>(null);
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(false);
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";
  const isHttpAgent = agentUrl.startsWith("http://");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const storedToken = localStorage.getItem(LOCAL_AGENT_TOKEN_KEY) ?? "";
    const storedUrl = localStorage.getItem(LOCAL_AGENT_URL_KEY) ?? DEFAULT_LOCAL_AGENT_URL;
    setAgentToken(storedToken);
    setAgentUrl(storedUrl);
    setAgentStatus(null);
  }, [isOpen]);

  // Retain logic for month label and computations
  const employeeEmail = employee?.person?.email;

  // Convertir mes a español
  dayjs.locale("es");
  let monthLabelEs = monthLabel;
  const monthMatch = MONTH_LABEL_REGEX.exec(monthLabel);
  if (monthMatch) {
    monthLabelEs = dayjs(`${monthMatch[1]}-${monthMatch[2]}-01`).locale("es").format("MMMM YYYY");
  } else if (dayjs(monthLabel, "MMMM YYYY", "en").isValid()) {
    monthLabelEs = dayjs(monthLabel, "MMMM YYYY", "en").locale("es").format("MMMM YYYY");
  }
  monthLabelEs = monthLabelEs.charAt(0).toUpperCase() + monthLabelEs.slice(1);

  if (!employee || !summary) {
    return null;
  }

  // Usar datos ya calculados del backend - no recalcular
  const totalMinutes = (summary.workedMinutes || 0) + (summary.overtimeMinutes || 0);
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;

  const boletaDescription = `SERVICIOS DE ${summary.role.toUpperCase()} ${totalHoursFormatted} HORAS`;

  // Get year from month in YYYY-MM format
  const summaryYear = month
    ? Number.parseInt(month.split("-")[0] ?? "", 10)
    : new Date().getFullYear();
  const employeeRate = summary.retentionRate ?? summary.retention_rate ?? null;
  const effectiveRate = getEffectiveRetentionRate(employeeRate, summaryYear);
  const retentionPercent = formatRetentionPercent(effectiveRate);

  return (
    <ModalRoot isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ModalBackdrop className="bg-black/40 backdrop-blur-[2px]">
        <ModalContainer placement="center">
          <ModalDialog className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-background p-0 shadow-2xl">
            {/* Custom Header with Gradient */}
            <div className="bg-linear-to-r from-primary to-primary/80 px-6 py-5 text-primary-foreground">
              <h2 className="font-bold text-xl">Vista previa del correo</h2>
              <p className="mt-1 text-sm opacity-90">
                Servicios de {summary.role} - {monthLabelEs}
              </p>
            </div>

            <ModalBody className="block max-h-[60vh] overflow-y-auto p-6">
              <div className="mb-4 rounded-xl border border-default-200 bg-default-50/40 p-4">
                <p className="mb-3 font-semibold text-sm">Agente local</p>
                <div className="mb-3">
                  <label className="mb-1 block text-default-600 text-xs">URL del agente</label>
                  <input
                    className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-sm"
                    onChange={(event) => {
                      const value = event.target.value;
                      setAgentUrl(value);
                      localStorage.setItem(LOCAL_AGENT_URL_KEY, value);
                    }}
                    placeholder="http://127.0.0.1:3333"
                    type="text"
                    value={agentUrl}
                  />
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-default-600 text-xs">Token</label>
                  <input
                    className="w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-sm"
                    onChange={(event) => {
                      const value = event.target.value;
                      setAgentToken(value);
                      localStorage.setItem(LOCAL_AGENT_TOKEN_KEY, value);
                    }}
                    placeholder="Token del agente local"
                    type="password"
                    value={agentToken}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    disabled={checkingAgent}
                    onClick={async () => {
                      setCheckingAgent(true);
                      setAgentStatus(null);
                      try {
                        const response = await fetch(`${agentUrl}/health`);
                        if (!response.ok) {
                          setAgentStatus("Agente respondió con error");
                        } else {
                          setAgentStatus("Agente activo");
                        }
                      } catch {
                        setAgentStatus("Agente no responde");
                      } finally {
                        setCheckingAgent(false);
                      }
                    }}
                    variant="secondary"
                  >
                    {checkingAgent ? "Verificando..." : "Verificar agente"}
                  </Button>
                  <Button
                    disabled={checkingSmtp || !agentToken}
                    onClick={async () => {
                      setCheckingSmtp(true);
                      setAgentStatus(null);
                      try {
                        const response = await fetch(`${agentUrl}/health/smtp`, {
                          headers: {
                            "X-Local-Agent-Token": agentToken,
                          },
                        });
                        if (!response.ok) {
                          setAgentStatus("SMTP no disponible o token inválido");
                        } else {
                          setAgentStatus("SMTP listo");
                        }
                      } catch {
                        setAgentStatus("No se pudo verificar SMTP");
                      } finally {
                        setCheckingSmtp(false);
                      }
                    }}
                    variant="secondary"
                  >
                    {checkingSmtp ? "Validando SMTP..." : "Verificar SMTP"}
                  </Button>
                  {agentStatus && <span className="text-default-600 text-xs">{agentStatus}</span>}
                </div>
                {isHttpsPage && isHttpAgent && (
                  <p className="mt-2 text-amber-600 text-xs">
                    El navegador bloquea HTTP desde una página HTTPS. Usa HTTPS en el agente local.
                  </p>
                )}
              </div>

              {/* Content wraps in ModalBody for spacing/scroll */}
              {/* Destinatario */}
              <div className="mb-4 rounded-xl bg-default-50/50 p-4">
                <p className="text-default-600 text-sm">
                  <strong>Para:</strong>{" "}
                  {employeeEmail ? (
                    <span className="font-medium text-foreground">{employeeEmail}</span>
                  ) : (
                    <span className="text-danger">⚠️ Sin email registrado</span>
                  )}
                </p>
                <p className="mt-1 text-default-600 text-sm">
                  <strong>Asunto:</strong>{" "}
                  <span className="font-medium text-foreground">
                    Boleta de Honorarios - {monthLabelEs} - {employee.full_name}
                  </span>
                </p>
              </div>

              {/* Preview del email - simula cómo se verá en el cliente de correo */}
              <div className="rounded-xl border border-default-200 bg-background p-5">
                <p className="mb-4 text-foreground">
                  Estimado/a <strong>{employee.full_name}</strong>,
                </p>
                <p className="mb-4 text-foreground text-sm">
                  A continuación encontrarás el resumen de los servicios prestados durante el
                  periodo <strong>{monthLabelEs}</strong>, favor corroborar y emitir boleta de
                  honorarios.
                </p>

                {/* Caja verde para la boleta */}
                <div className="mb-4 rounded-lg border-2 border-green-500 bg-green-100 p-4">
                  <p className="mb-3 font-semibold text-green-800 text-xs uppercase tracking-wider">
                    📝 Para la boleta de honorarios
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="mb-1 text-green-800 text-xs">Descripción:</p>
                      <p className="font-bold font-mono text-green-800 text-sm">
                        {boletaDescription}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-green-800 text-xs">Monto Bruto:</p>
                      <p className="font-bold font-mono text-green-800 text-xl">
                        {fmtCLP(summary.subtotal)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tabla resumen (Grid Layout) */}
                <div className="mb-4 w-full text-sm">
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 bg-default-50 px-3 py-2 font-semibold text-xs uppercase">
                    <div className="text-default-600">Concepto</div>
                    <div className="text-right text-default-600">Detalle</div>
                  </div>

                  <div className="divide-y divide-base-300 border-default-200 border-x border-b">
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-3">
                      <div className="text-foreground">Horas totales</div>
                      <div className="text-right font-mono text-foreground">
                        {totalHoursFormatted}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-3">
                      <div className="text-foreground">Monto Bruto</div>
                      <div className="text-right font-mono text-foreground">
                        {fmtCLP(summary.subtotal)}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-3">
                      <div className="text-foreground">Retención ({retentionPercent})</div>
                      <div className="text-right font-mono text-foreground">
                        -{fmtCLP(summary.retention)}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 bg-blue-700 px-3 py-3">
                      <div className="font-bold text-white">Total Líquido</div>
                      <div className="text-right font-bold font-mono text-white">
                        {fmtCLP(summary.net)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fecha de pago */}
                <div className="rounded-lg border border-amber-500 bg-amber-100 p-3 text-center text-sm">
                  <strong className="text-amber-800">
                    📅 Fecha de pago estimada:{" "}
                    {summary.payDate
                      ? dayjs(summary.payDate, "YYYY-MM-DD").format("DD-MM-YYYY")
                      : "—"}
                  </strong>
                </div>

                {/* Nota de adjunto */}
                <div className="mt-3 rounded-lg border border-sky-500 bg-sky-100 p-3 text-sky-700 text-sm">
                  <strong>📎 Adjunto:</strong> Se incluye el documento PDF con el detalle completo
                  de horas trabajadas.
                </div>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between border-default-200 border-t bg-background px-6 py-4">
              <p className="mr-4 flex-1 text-default-400 text-xs">
                {prepareStatus === "generating-pdf" && "Generando documento PDF..."}
                {prepareStatus === "preparing-payload" && "Preparando contenido del email..."}
                {prepareStatus === "sending" && "Enviando correo desde el agente local..."}
                {prepareStatus === "done" && "✅ Email enviado correctamente"}
                {!prepareStatus && "Se enviará el correo desde tu Mac usando el agente local."}
              </p>
              <div className="flex shrink-0 gap-3">
                <Button disabled={isPreparing} onClick={onClose} variant="secondary">
                  {prepareStatus === "done" ? "Cerrar" : "Cancelar"}
                </Button>
                <Button
                  className="min-w-44"
                  disabled={isPreparing || !employeeEmail || prepareStatus === "done"}
                  onClick={onPrepare}
                  variant="primary"
                >
                  {renderPrepareButtonContent(prepareStatus)}
                </Button>
              </div>
            </ModalFooter>
          </ModalDialog>
        </ModalContainer>
      </ModalBackdrop>
    </ModalRoot>
  );
}

function renderPrepareButtonContent(status: string | null) {
  if (status === "generating-pdf") {
    return (
      <span className="flex items-center gap-2">
        <Spinner size="sm" />
        Generando PDF...
      </span>
    );
  }
  if (status === "preparing-payload") {
    return (
      <span className="flex items-center gap-2">
        <Spinner size="sm" />
        Preparando...
      </span>
    );
  }
  if (status === "sending") {
    return (
      <span className="flex items-center gap-2">
        <Spinner size="sm" />
        Enviando...
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex items-center gap-2">
        <span>📧</span>
        Descargado
      </span>
    );
  }
  return <>Preparar Email</>;
}
