import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Modal,
  Skeleton,
  Tabs,
  TextField,
} from "@heroui/react";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Employee } from "@/features/hr/employees/types";
import { fetchTimesheetEmailPreview } from "@/features/hr/timesheets/api";

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
const DEFAULT_LOCAL_AGENT_URL = getDefaultLocalAgentUrl();
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

  const employeeEmail = employee?.person?.email;
  const monthLabelEs = getMonthLabelInSpanish(monthLabel);

  if (!employee || !summary) {
    return null;
  }

  const previewRequest = useMemo(
    () => ({
      employeeEmail: employeeEmail ?? "",
      employeeId: employee.id,
      employeeName: employee.full_name,
      month,
      monthLabel: monthLabelEs,
      summary: {
        net: summary.net,
        overtimeMinutes: summary.overtimeMinutes,
        payDate: summary.payDate,
        retention: summary.retention,
        retention_rate: summary.retention_rate,
        retentionRate: summary.retentionRate,
        role: summary.role,
        subtotal: summary.subtotal,
        workedMinutes: summary.workedMinutes,
      },
    }),
    [employee.id, employee.full_name, employeeEmail, month, monthLabelEs, summary]
  );

  const previewQuery = useQuery({
    enabled: isOpen && Boolean(employeeEmail),
    queryFn: () => fetchTimesheetEmailPreview(previewRequest),
    queryKey: ["timesheet-email-preview", previewRequest],
    staleTime: 60_000,
  });

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-6xl overflow-hidden rounded-3xl bg-background p-0 shadow-2xl">
            <Modal.Header className="border-default-200 border-b bg-content1 px-6 py-5">
              <Modal.Heading className="block font-semibold text-2xl">Enviar correo</Modal.Heading>
              <Description className="mt-1 max-w-3xl text-default-600 text-sm">
                Esta vista usa el HTML real generado por la API. Lo que ves aquí es la misma base
                que enviará el agente local, no un mock alterno.
              </Description>
            </Modal.Header>

            <Modal.Body className="block max-h-[78vh] overflow-y-auto bg-default-50/40 p-5">
              <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <Card>
                    <Card.Header className="flex flex-col items-start gap-1">
                      <Card.Title>Destinatario</Card.Title>
                      <Card.Description>
                        Datos del mensaje que se enviará desde tu Mac.
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="space-y-3 text-sm">
                      <MetadataItem
                        label="Para"
                        value={employeeEmail ?? "Sin email registrado"}
                        valueClassName={employeeEmail ? undefined : "text-danger"}
                      />
                      <MetadataItem
                        label="Asunto"
                        value={
                          previewQuery.data?.subject ??
                          `Boleta de Honorarios - ${monthLabelEs} - ${employee.full_name}`
                        }
                      />
                      <MetadataItem label="Periodo" value={monthLabelEs} />
                      <MetadataItem label="Adjunto" value="resumen_honorarios.pdf" />
                    </Card.Content>
                  </Card>

                  <Card>
                    <Card.Header className="flex flex-col items-start gap-1">
                      <Card.Title>Agente local</Card.Title>
                      <Card.Description>
                        SMTP e IMAP deben estar disponibles antes del envío.
                      </Card.Description>
                    </Card.Header>
                    <Card.Content>
                      <LocalAgentPanel isHttpsPage={isHttpsPage} state={localAgent} />
                    </Card.Content>
                  </Card>

                  <Card>
                    <Card.Header className="flex flex-col items-start gap-1">
                      <Card.Title>Estado de la preview</Card.Title>
                      <Card.Description>
                        Generada desde el backend con los mismos datos del envío.
                      </Card.Description>
                    </Card.Header>
                    <Card.Content className="space-y-2">
                      <Chip
                        color={
                          previewQuery.isError
                            ? "danger"
                            : previewQuery.isFetching
                              ? "warning"
                              : "success"
                        }
                        variant="soft"
                      >
                        {previewQuery.isError
                          ? "No se pudo cargar la preview"
                          : previewQuery.isFetching
                            ? "Actualizando vista previa"
                            : "Preview sincronizada"}
                      </Chip>
                      <Description className="text-default-500 text-xs">
                        El adjunto PDF se genera al enviar. La vista previa usa el mismo asunto,
                        texto y HTML del correo final.
                      </Description>
                    </Card.Content>
                  </Card>
                </div>

                <Card className="overflow-hidden">
                  <Card.Header className="flex flex-col items-start gap-3 border-default-200 border-b bg-content1">
                    <div className="flex w-full flex-wrap items-center justify-between gap-3">
                      <div>
                        <Card.Title>Vista previa del correo</Card.Title>
                        <Card.Description>
                          Render fiel del HTML generado para {employee.full_name}.
                        </Card.Description>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip size="sm" variant="soft">
                          {summary.role}
                        </Chip>
                        <Chip size="sm" variant="soft">
                          {monthLabelEs}
                        </Chip>
                      </div>
                    </div>
                  </Card.Header>
                  <Card.Content className="bg-default-100 p-3 sm:p-4">
                    {previewQuery.isError ? (
                      <Alert status="danger">
                        <Alert.Content>
                          <Alert.Description>
                            {previewQuery.error instanceof Error
                              ? previewQuery.error.message
                              : "No se pudo cargar la vista previa del correo."}
                          </Alert.Description>
                        </Alert.Content>
                      </Alert>
                    ) : !employeeEmail ? (
                      <Alert status="warning">
                        <Alert.Content>
                          <Alert.Description>
                            El colaborador no tiene un email registrado, así que no se puede generar
                            la vista previa del envío.
                          </Alert.Description>
                        </Alert.Content>
                      </Alert>
                    ) : (
                      <Tabs
                        aria-label="Vista previa del correo"
                        className="flex min-h-0 flex-col"
                        defaultSelectedKey="html"
                      >
                        <Tabs.ListContainer className="pb-3">
                          <Tabs.List
                            aria-label="Formato de vista previa"
                            className="rounded-xl bg-default-200/70 p-1"
                          >
                            <Tabs.Tab id="html">
                              HTML
                              <Tabs.Indicator />
                            </Tabs.Tab>
                            <Tabs.Tab id="text">
                              Texto plano
                              <Tabs.Indicator />
                            </Tabs.Tab>
                          </Tabs.List>
                        </Tabs.ListContainer>

                        <Tabs.Panel className="min-h-0" id="html">
                          {previewQuery.isPending ? (
                            <PreviewSkeleton />
                          ) : (
                            <div className="overflow-hidden rounded-2xl border border-default-300 bg-white shadow-sm">
                              <div className="flex items-center gap-2 border-default-200 border-b bg-default-50 px-4 py-3">
                                <span className="size-2.5 rounded-full bg-danger-400" />
                                <span className="size-2.5 rounded-full bg-warning-400" />
                                <span className="size-2.5 rounded-full bg-success-400" />
                                <span className="ml-2 text-default-500 text-xs">
                                  Cliente de correo
                                </span>
                              </div>
                              <iframe
                                className="h-230 w-full bg-white"
                                srcDoc={previewQuery.data?.html}
                                title="Vista previa HTML del correo"
                              />
                            </div>
                          )}
                        </Tabs.Panel>

                        <Tabs.Panel className="min-h-0" id="text">
                          {previewQuery.isPending ? (
                            <PreviewSkeleton />
                          ) : (
                            <div className="rounded-2xl border border-default-300 bg-content1 p-4 shadow-sm">
                              <pre className="whitespace-pre-wrap wrap-break-word font-mono text-sm leading-6 text-foreground">
                                {previewQuery.data?.text}
                              </pre>
                            </div>
                          )}
                        </Tabs.Panel>
                      </Tabs>
                    )}
                  </Card.Content>
                </Card>
              </div>
            </Modal.Body>

            <Modal.Footer className="flex items-center justify-between border-default-200 border-t bg-background px-6 py-4">
              <Description className="mr-4 flex-1 text-default-400 text-xs">
                {getPrepareStatusMessage(prepareStatus)}
              </Description>
              <div className="flex shrink-0 gap-3">
                <Button isDisabled={isPreparing} onPress={onClose} variant="secondary">
                  {prepareStatus === "done" ? "Cerrar" : "Cancelar"}
                </Button>
                <Button
                  className="min-w-44"
                  isDisabled={isPreparing || !employeeEmail || prepareStatus === "done"}
                  isPending={isPreparing}
                  onPress={onPrepare}
                  variant="primary"
                >
                  {renderPrepareButtonContent(prepareStatus)}
                </Button>
              </div>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function MetadataItem({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-default-500 text-xs uppercase tracking-[0.14em]">{label}</div>
      <div className={valueClassName ?? "text-foreground"}>{value}</div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-default-300 bg-content1 p-4">
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-16 rounded-xl" />
      <Skeleton className="h-72 rounded-2xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}

function LocalAgentPanel({ isHttpsPage, state }: { isHttpsPage: boolean; state: LocalAgentState }) {
  return (
    <>
      <span className="mb-3 block font-semibold text-sm">Agente local</span>
      <div className="mb-3">
        <TextField
          id="local-agent-url"
          type="text"
          value={state.agentUrl}
          onChange={state.setAgentUrlValue}
        >
          <Label>URL del agente</Label>
          <Input placeholder="https://127.0.0.1:3333" />
        </TextField>
      </div>
      <div className="mb-3">
        <TextField
          id="local-agent-token"
          type="password"
          value={state.agentToken}
          onChange={state.setAgentTokenValue}
        >
          <Label>Token</Label>
          <Input placeholder="Token del agente local" />
        </TextField>
      </div>
      <div className="flex items-center gap-3">
        <Button isDisabled={state.checkingAgent} onPress={state.verifyAgent} variant="secondary">
          {state.checkingAgent ? "Verificando..." : "Verificar agente"}
        </Button>
        <Button
          isDisabled={state.checkingSmtp || !state.agentToken}
          onPress={state.verifySmtp}
          variant="secondary"
        >
          {state.checkingSmtp ? "Validando SMTP..." : "Verificar SMTP"}
        </Button>
        <Button
          isDisabled={state.stoppingAgent || !state.agentToken}
          onPress={state.stopAgent}
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

function getDefaultLocalAgentUrl() {
  if (import.meta.env.VITE_LOCAL_MAIL_AGENT_URL) {
    return import.meta.env.VITE_LOCAL_MAIL_AGENT_URL;
  }
  if (typeof window !== "undefined" && window.location.protocol === "http:") {
    return "http://127.0.0.1:3333";
  }
  return "https://127.0.0.1:3333";
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
    return "Correo enviado correctamente.";
  }
  return "Se enviará el correo desde tu Mac usando el agente local.";
}

function renderPrepareButtonContent(status: PrepareStatus) {
  if (status === "generating-pdf") {
    return "Generando PDF...";
  }
  if (status === "preparing-payload") {
    return "Preparando...";
  }
  if (status === "sending") {
    return "Enviando...";
  }
  if (status === "done") {
    return "Enviado";
  }
  return "Enviar correo";
}
