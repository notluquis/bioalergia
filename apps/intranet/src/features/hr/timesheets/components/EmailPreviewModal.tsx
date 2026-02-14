import {
  Chip,
  Description,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalRoot,
  Spinner,
} from "@heroui/react";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  prepareStatus: PrepareStatus;
  summary: null | TimesheetSummaryRow;
}

const LOCAL_AGENT_TOKEN_KEY = "bioalergia_local_mail_agent_token";
const LOCAL_AGENT_URL_KEY = "bioalergia_local_mail_agent_url";
const DEFAULT_LOCAL_AGENT_URL =
  import.meta.env.VITE_LOCAL_MAIL_AGENT_URL ?? "https://127.0.0.1:3333";
const TRAILING_SLASHES_REGEX = /\/+$/;

type AgentStatus = {
  kind: "danger" | "success" | "warning";
  message: string;
};

export type PrepareStatus = "done" | "generating-pdf" | "preparing-payload" | "sending" | null;

type LocalAgentState = {
  agentStatus: AgentStatus | null;
  agentToken: string;
  agentUrl: string;
  checkingAgent: boolean;
  checkingSmtp: boolean;
  isHttpAgent: boolean;
  setAgentTokenValue: (value: string) => void;
  setAgentUrlValue: (value: string) => void;
  stopAgent: () => Promise<void>;
  stoppingAgent: boolean;
  verifyAgent: () => Promise<void>;
  verifySmtp: () => Promise<void>;
};

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
  const localAgent = useLocalAgentPanelState(isOpen);
  const isHttpsPage = typeof window !== "undefined" && window.location.protocol === "https:";

  // Retain logic for month label and computations
  const employeeEmail = employee?.person?.email;
  const monthLabelEs = getMonthLabelInSpanish(monthLabel);

  if (!employee || !summary) {
    return null;
  }

  // Usar datos ya calculados del backend - no recalcular
  const totalMinutes = (summary.workedMinutes || 0) + (summary.overtimeMinutes || 0);
  const totalHrs = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;
  const totalHoursFormatted = `${String(totalHrs).padStart(2, "0")}:${String(totalMins).padStart(2, "0")}`;

  const boletaDescription = `SERVICIOS PROFESIONALES DE ${summary.role.toUpperCase()} - PERIODO ${monthLabelEs.toUpperCase()} - TIEMPO FACTURABLE ${totalHoursFormatted}`;

  // Get year from month in YYYY-MM format
  const summaryYear = getSummaryYear(month);
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
              <span className="block font-bold text-xl">Vista previa del correo</span>
              <Description className="mt-1 text-sm opacity-90">
                Servicios de {summary.role} - {monthLabelEs}
              </Description>
            </div>

            <ModalBody className="block max-h-[60vh] overflow-y-auto p-6">
              <div className="mb-4 rounded-xl border border-default-200 bg-default-50/40 p-4">
                <LocalAgentPanel isHttpsPage={isHttpsPage} state={localAgent} />
              </div>

              {/* Content wraps in ModalBody for spacing/scroll */}
              {/* Destinatario */}
              <div className="mb-4 rounded-xl bg-default-50/50 p-4">
                <Description className="text-default-600 text-sm">
                  <strong>Para:</strong>{" "}
                  {employeeEmail ? (
                    <span className="font-medium text-foreground">{employeeEmail}</span>
                  ) : (
                    <span className="text-danger">⚠️ Sin email registrado</span>
                  )}
                </Description>
                <Description className="mt-1 text-default-600 text-sm">
                  <strong>Asunto:</strong>{" "}
                  <span className="font-medium text-foreground">
                    Boleta de Honorarios - {monthLabelEs} - {employee.full_name}
                  </span>
                </Description>
              </div>

              {/* Preview del email - simula cómo se verá en el cliente de correo */}
              <div className="rounded-xl border border-default-200 bg-background p-5">
                <Description className="mb-4 text-foreground">
                  Estimado/a <strong>{employee.full_name}</strong>,
                </Description>
                <Description className="mb-4 text-foreground text-sm">
                  Junto con saludar, comparto el resumen de prestaciones de servicios profesionales
                  a honorarios correspondientes al periodo <strong>{monthLabelEs}</strong>, para su
                  revisión.
                </Description>
                <Description className="mb-4 text-foreground text-sm">
                  Si está conforme, agradeceré emitir la Boleta de Honorarios Electrónica (BHE) por
                  el monto bruto indicado, considerando la retención vigente según corresponda en la
                  emisión.
                </Description>

                {/* Caja verde para la boleta */}
                <div className="mb-4 rounded-lg border-2 border-green-500 bg-green-100 p-4">
                  <Description className="mb-3 font-semibold text-green-800 text-xs uppercase tracking-wider">
                    🧾 Datos para emitir BHE
                  </Description>
                  <div className="space-y-2">
                    <div>
                      <Description className="mb-1 text-green-800 text-xs">
                        Descripción sugerida:
                      </Description>
                      <span className="font-bold font-mono text-green-800 text-sm">
                        {boletaDescription}
                      </span>
                    </div>
                    <div>
                      <Description className="mb-1 text-green-800 text-xs">
                        Monto bruto honorarios:
                      </Description>
                      <span className="font-bold font-mono text-green-800 text-xl">
                        {fmtCLP(summary.subtotal)}
                      </span>
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
                      <div className="text-foreground">Tiempo total facturable</div>
                      <div className="text-right font-mono text-foreground">
                        {totalHoursFormatted}
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-3">
                      <div className="text-foreground">Monto bruto de honorarios</div>
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
                      <div className="font-bold text-white">Líquido estimado</div>
                      <div className="text-right font-bold font-mono text-white">
                        {fmtCLP(summary.net)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Fecha de pago */}
                <div className="rounded-lg border border-amber-500 bg-amber-100 p-3 text-center text-sm">
                  <strong className="text-amber-800">
                    📅 Fecha estimada de pago/transferencia de honorarios:{" "}
                    {summary.payDate
                      ? dayjs(summary.payDate, "YYYY-MM-DD").format("DD-MM-YYYY")
                      : "—"}
                  </strong>
                </div>

                {/* Nota de adjunto */}
                <div className="mt-3 rounded-lg border border-sky-500 bg-sky-100 p-3 text-sky-700 text-sm">
                  <strong>📎 Adjunto:</strong> Documento PDF con el detalle del periodo para
                  respaldo y conciliación.
                </div>

                {/* Nota legal */}
                <Description className="mt-3 text-default-600 text-xs">
                  Nota: El detalle de tramos horarios se incluye únicamente para fines de
                  respaldo/conciliación de honorarios y no constituye control de jornada ni implica
                  subordinación o dependencia.
                </Description>
              </div>
            </ModalBody>

            <ModalFooter className="flex items-center justify-between border-default-200 border-t bg-background px-6 py-4">
              <Description className="mr-4 flex-1 text-default-400 text-xs">
                {getPrepareStatusMessage(prepareStatus)}
              </Description>
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

function LocalAgentPanel({ isHttpsPage, state }: { isHttpsPage: boolean; state: LocalAgentState }) {
  return (
    <>
      <span className="mb-3 block font-semibold text-sm">Agente local</span>
      <div className="mb-3">
        <Input
          id="local-agent-url"
          label="URL del agente"
          onChange={(event) => state.setAgentUrlValue(event.target.value)}
          placeholder="https://127.0.0.1:3333"
          type="text"
          value={state.agentUrl}
        />
      </div>
      <div className="mb-3">
        <Input
          id="local-agent-token"
          label="Token"
          onChange={(event) => state.setAgentTokenValue(event.target.value)}
          placeholder="Token del agente local"
          type="password"
          value={state.agentToken}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={state.checkingAgent} onClick={state.verifyAgent} variant="secondary">
          {state.checkingAgent ? "Verificando..." : "Verificar agente"}
        </Button>
        <Button
          disabled={state.checkingSmtp || !state.agentToken}
          onClick={state.verifySmtp}
          variant="secondary"
        >
          {state.checkingSmtp ? "Validando SMTP..." : "Verificar SMTP"}
        </Button>
        <Button
          disabled={state.stoppingAgent || !state.agentToken}
          onClick={state.stopAgent}
          variant="secondary"
        >
          {state.stoppingAgent ? "Apagando..." : "Apagar agente"}
        </Button>
      </div>
      {state.agentStatus && (
        <div className="mt-2">
          <Chip color={state.agentStatus.kind} size="sm" variant="soft">
            {state.agentStatus.message}
          </Chip>
        </div>
      )}
      {isHttpsPage && state.isHttpAgent && (
        <Description className="mt-2 text-amber-600 text-xs">
          El navegador bloquea HTTP desde una página HTTPS. Usa HTTPS en el agente local.
        </Description>
      )}
    </>
  );
}

function useLocalAgentPanelState(isOpen: boolean): LocalAgentState {
  const [agentToken, setAgentToken] = useState("");
  const [agentUrl, setAgentUrl] = useState(DEFAULT_LOCAL_AGENT_URL);
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [checkingSmtp, setCheckingSmtp] = useState(false);
  const [stoppingAgent, setStoppingAgent] = useState(false);

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

  const setAgentTokenValue = useCallback((value: string) => {
    setAgentToken(value);
    localStorage.setItem(LOCAL_AGENT_TOKEN_KEY, value);
  }, []);

  const setAgentUrlValue = useCallback((value: string) => {
    setAgentUrl(value);
    localStorage.setItem(LOCAL_AGENT_URL_KEY, value);
  }, []);

  const verifyAgent = useCallback(async () => {
    setCheckingAgent(true);
    setAgentStatus(null);
    try {
      const response = await fetch(`${normalizeAgentUrl(agentUrl)}/health`);
      if (!response.ok) {
        const message = await readLocalAgentErrorMessage(response, "Agente respondió con error");
        setAgentStatus({ kind: "danger", message });
      } else {
        setAgentStatus({ kind: "success", message: "Agente activo" });
      }
    } catch {
      setAgentStatus({
        kind: "danger",
        message: "Agente no responde. Revisa URL, HTTPS/certificado y que esté corriendo.",
      });
    } finally {
      setCheckingAgent(false);
    }
  }, [agentUrl]);

  const verifySmtp = useCallback(async () => {
    setCheckingSmtp(true);
    setAgentStatus(null);
    try {
      const response = await fetch(`${normalizeAgentUrl(agentUrl)}/health/smtp`, {
        headers: {
          "X-Local-Agent-Token": agentToken,
        },
      });
      if (!response.ok) {
        if (response.status === 401) {
          setAgentStatus({
            kind: "warning",
            message: "Token inválido o faltante",
          });
          return;
        }
        const message = await readLocalAgentErrorMessage(response, "SMTP no disponible");
        setAgentStatus({
          kind: "danger",
          message: `SMTP no disponible: ${message}`,
        });
      } else {
        setAgentStatus({ kind: "success", message: "SMTP listo" });
      }
    } catch {
      setAgentStatus({ kind: "danger", message: "No se pudo verificar SMTP" });
    } finally {
      setCheckingSmtp(false);
    }
  }, [agentToken, agentUrl]);

  const stopAgent = useCallback(async () => {
    setStoppingAgent(true);
    setAgentStatus(null);
    try {
      const response = await fetch(`${normalizeAgentUrl(agentUrl)}/shutdown`, {
        method: "POST",
        headers: {
          "X-Local-Agent-Token": agentToken,
        },
      });
      if (!response.ok) {
        const message = await readLocalAgentErrorMessage(response, "No se pudo apagar el agente");
        setAgentStatus({ kind: "danger", message });
      } else {
        setAgentStatus({ kind: "warning", message: "Agente apagándose..." });
      }
    } catch {
      setAgentStatus({
        kind: "danger",
        message: "No se pudo contactar al agente para apagarlo.",
      });
    } finally {
      setStoppingAgent(false);
    }
  }, [agentToken, agentUrl]);

  return {
    agentStatus,
    agentToken,
    agentUrl,
    checkingAgent,
    checkingSmtp,
    isHttpAgent: agentUrl.startsWith("http://"),
    setAgentTokenValue,
    setAgentUrlValue,
    stopAgent,
    stoppingAgent,
    verifyAgent,
    verifySmtp,
  };
}

async function readLocalAgentErrorMessage(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return fallbackMessage;
  }

  try {
    const data = (await response.json()) as { code?: string; message?: string };
    if (!data?.message) {
      return fallbackMessage;
    }
    return data.code ? `${data.message} (${data.code})` : data.message;
  } catch {
    return fallbackMessage;
  }
}

function normalizeAgentUrl(value: string) {
  return value.trim().replace(TRAILING_SLASHES_REGEX, "");
}

function getMonthLabelInSpanish(monthLabel: string) {
  dayjs.locale("es");
  const monthMatch = MONTH_LABEL_REGEX.exec(monthLabel);
  const normalizedMonthLabel = monthMatch
    ? dayjs(`${monthMatch[1]}-${monthMatch[2]}-01`).locale("es").format("MMMM YYYY")
    : dayjs(monthLabel, "MMMM YYYY", "en").isValid()
      ? dayjs(monthLabel, "MMMM YYYY", "en").locale("es").format("MMMM YYYY")
      : monthLabel;
  return normalizedMonthLabel.charAt(0).toUpperCase() + normalizedMonthLabel.slice(1);
}

function getSummaryYear(month: string) {
  return month ? Number.parseInt(month.split("-")[0] ?? "", 10) : new Date().getFullYear();
}

function getPrepareStatusMessage(status: PrepareStatus) {
  if (status === "generating-pdf") {
    return "Generando documento PDF...";
  }
  if (status === "preparing-payload") {
    return "Preparando contenido del email...";
  }
  if (status === "sending") {
    return "Enviando correo desde el agente local...";
  }
  if (status === "done") {
    return "✅ Email enviado correctamente";
  }
  return "Se enviará el correo desde tu Mac usando el agente local.";
}

function renderPrepareButtonContent(status: PrepareStatus) {
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
