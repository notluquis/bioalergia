import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Skeleton,
  Surface,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Send, Wifi, WifiOff } from "lucide-react";
import { Fragment, type ReactNode, useEffect, useState } from "react";

import { useToast } from "@/context/ToastContext";
import { useSettings } from "@/context/SettingsContext";
import {
  sendWhatsappTest,
  setWhatsappContactConsent,
  toggleWhatsappConnection,
} from "@/features/whatsapp/api";
import { whatsappKeys } from "@/features/whatsapp/queries";
import { PAGE_CONTAINER } from "@/lib/styles";

function renderWhatsappInlineFormatting(text: string): ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/g).map((part, index) => {
    const isBold = part.startsWith("*") && part.endsWith("*") && part.length >= 2;
    if (!isBold) {
      return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
    }

    return <strong key={`${part}-${index}`}>{part.slice(1, -1)}</strong>;
  });
}

function renderWhatsappPreview(text: string) {
  const lines = text.split("\n");

  return lines.map((line, index) => (
    <Fragment key={`${line}-${index}`}>
      {line.length === 0 ? (
        <div className="h-4" />
      ) : (
        <div>{renderWhatsappInlineFormatting(line)}</div>
      )}
    </Fragment>
  ));
}

export function WhatsappSettingsPage() {
  const { error: showError, success: showSuccess } = useToast();
  const { settings, updateSettings } = useSettings();
  const queryClient = useQueryClient();
  const [consentPhone, setConsentPhone] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(settings.whatsappFreeformMessage);

  const { data: overview } = useQuery({
    ...whatsappKeys.overview(),
    refetchInterval: 30_000,
  });

  const { data: connectionStatus } = useQuery(whatsappKeys.connectionStatus());

  const { data: contactsData, isPending: contactsPending } = useQuery({
    ...whatsappKeys.contacts({
      limit: 24,
      offset: 0,
      search: contactSearch.trim() ? contactSearch : undefined,
    }),
    refetchInterval: 30_000,
  });

  const testMutation = useMutation({
    mutationFn: () => sendWhatsappTest(testPhone),
    onError: (err: Error) => showError(`Error al enviar: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "ok") {
        showSuccess(result.message, "Mensaje enviado");
      } else {
        showError(result.message, "Error al enviar");
      }
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.overview().queryKey });
    },
  });

  const consentMutation = useMutation({
    mutationFn: (args: { phone: string; status: "OPTED_IN" | "OPTED_OUT" }) =>
      setWhatsappContactConsent({
        phone: args.phone,
        source: "settings_whatsapp",
        status: args.status,
      }),
    onError: (err: Error) => showError(`Error al guardar consentimiento: ${err.message}`),
    onSuccess: (result) => {
      showSuccess(
        `Consentimiento actualizado para ${result.phone}: ${result.optInStatus}`,
        "Consentimiento guardado"
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappKeys.overview().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "contacts"] }),
      ]);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleWhatsappConnection,
    onError: (err: Error) => showError(`Error: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "ok") showSuccess(result.message);
      else showError(result.message);
      void queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
    },
  });

  const messageTemplateMutation = useMutation({
    mutationFn: async () => {
      await updateSettings({
        ...settings,
        whatsappFreeformMessage: messageTemplate,
      });
    },
    onError: (err: Error) => showError(`Error al guardar mensaje: ${err.message}`),
    onSuccess: () => showSuccess("Mensaje de WhatsApp actualizado"),
  });

  const { data: stats } = useQuery({
    ...whatsappKeys.stats(),
    refetchInterval: 30_000,
  });

  const enabled = connectionStatus?.enabled ?? false;
  const connected = connectionStatus?.connectionState === "open";
  const connecting = connectionStatus?.connectionState === "connecting";

  useEffect(() => {
    setMessageTemplate(settings.whatsappFreeformMessage);
  }, [settings.whatsappFreeformMessage]);

  return (
    <div className={PAGE_CONTAINER}>
      <Tabs defaultSelectedKey="channel">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones de WhatsApp">
            <Tabs.Tab id="channel">
              Canal
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="consent">
              Consentimiento
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="testing">
              Pruebas
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="channel">
          <div className="mt-4 space-y-4">
            {/* ── Connection toggle ─────────────────────────────────── */}
            <Surface className="flex items-center justify-between rounded-2xl border border-default-200 px-5 py-4">
              <div className="flex items-center gap-3">
                {connected ? (
                  <Wifi className="h-5 w-5 text-success" />
                ) : (
                  <WifiOff className="h-5 w-5 text-default-400" />
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {connected
                      ? "WhatsApp conectado"
                      : enabled && connecting
                        ? "Conectando..."
                        : enabled
                          ? "Esperando vinculación"
                          : "WhatsApp desactivado"}
                  </p>
                  <Description className="text-default-500 text-xs">
                    {connected
                      ? "Listo para enviar y recibir mensajes"
                      : "Conexión directa vía Baileys"}
                  </Description>
                </div>
              </div>
              <Switch
                isDisabled={toggleMutation.isPending}
                isSelected={enabled}
                onChange={() => toggleMutation.mutate()}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </Surface>

            <Alert status="accent">
              Esta pantalla cubre el canal de salida de WhatsApp: sesión, consentimiento y envío. La
              ingesta de correos Doctoralia se revisa en Settings → Doctoralia.
            </Alert>

            {/* ── QR code (only when enabled + not connected) ──────── */}
            {enabled && !connected && (
              <Card>
                <Card.Content className="flex flex-col items-center gap-4 py-8">
                  {connectionStatus?.qrDataUrl ? (
                    <>
                      <img
                        alt="QR code para vincular WhatsApp"
                        className="h-64 w-64 rounded-xl border border-default-200"
                        src={connectionStatus.qrDataUrl}
                      />
                      <Description className="max-w-xs text-center text-default-500 text-xs">
                        Abre WhatsApp → Configuración → Dispositivos vinculados → Vincular un
                        dispositivo.
                      </Description>
                    </>
                  ) : (
                    <>
                      <Skeleton className="h-64 w-64 rounded-xl" />
                      <Description className="text-default-400 text-xs">
                        Esperando código QR...
                      </Description>
                    </>
                  )}
                </Card.Content>
              </Card>
            )}

            {/* ── Stats + Channel automation ───────────────────────── */}
            {enabled && (
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Channel automation */}
                {overview && (
                  <Card>
                    <Card.Header>
                      <h2 className="font-semibold text-sm">Canal y automatización</h2>
                    </Card.Header>
                    <Card.Content className="flex flex-wrap gap-2">
                      <Chip
                        color={overview.automaticFlowReady ? "success" : "warning"}
                        size="sm"
                        variant="soft"
                      >
                        {overview.automaticFlowReady ? "Canal listo" : "Canal incompleto"}
                      </Chip>
                      <Chip
                        color={overview.connected ? "success" : "default"}
                        size="sm"
                        variant="soft"
                      >
                        WhatsApp {overview.connected ? "OK" : "pendiente"}
                      </Chip>
                      <Chip
                        color={overview.automaticNotificationsEnabled ? "success" : "default"}
                        size="sm"
                        variant="soft"
                      >
                        Automatización {overview.automaticNotificationsEnabled ? "ON" : "OFF"}
                      </Chip>
                    </Card.Content>
                  </Card>
                )}

                <Card className="lg:col-span-2">
                  <Card.Header className="flex flex-col items-start gap-1">
                    <h2 className="font-semibold text-sm">Mensaje automatico</h2>
                    <Description className="text-default-500 text-xs">
                      Se usa para reservas de Doctoralia. Si queda vacio, el sistema usa el mensaje
                      por defecto. Variables disponibles: {"{{patientName}}"},{" "}
                      {"{{appointmentDate}}"}, {"{{appointmentDoctor}}"}, {"{{appointmentService}}"}{" "}
                      y {"{{clinicAddress}}"}.
                    </Description>
                  </Card.Header>
                  <Card.Content className="space-y-4">
                    <TextField value={messageTemplate} onChange={setMessageTemplate}>
                      <Label>Mensaje automatico</Label>
                      <TextArea
                        className="w-full"
                        placeholder="Escribe el mensaje que se enviara por WhatsApp..."
                        rows={14}
                        variant="secondary"
                      />
                      <Description>
                        Usa formato de WhatsApp como *negrita* y saltos de linea. La vista previa de
                        abajo simula el resultado.
                      </Description>
                    </TextField>
                    <Surface
                      className="space-y-3 rounded-2xl border border-default-200 p-4"
                      variant="secondary"
                    >
                      <div className="font-semibold text-default-700 text-xs uppercase tracking-wide">
                        Vista previa
                      </div>
                      <Surface
                        className="rounded-[24px] border border-default-200 bg-default-50 px-4 py-3 shadow-sm"
                        variant="secondary"
                      >
                        <div className="mb-2 text-default-500 text-[11px]">WhatsApp</div>
                        <div className="space-y-1 whitespace-pre-wrap wrap-break-word text-foreground text-sm leading-6">
                          {renderWhatsappPreview(
                            messageTemplate.trim() ||
                              "Se usara el mensaje por defecto del sistema si este campo queda vacio."
                          )}
                        </div>
                      </Surface>
                    </Surface>
                    <div className="flex justify-end">
                      <Button
                        isDisabled={messageTemplateMutation.isPending}
                        isPending={messageTemplateMutation.isPending}
                        onPress={() => messageTemplateMutation.mutate()}
                        size="sm"
                        variant="primary"
                      >
                        Guardar mensaje
                      </Button>
                    </div>
                  </Card.Content>
                </Card>

                {/* Message stats */}
                {connected &&
                  stats &&
                  stats.sent +
                    stats.delivered +
                    stats.read +
                    stats.played +
                    stats.pending +
                    stats.failed >
                    0 && (
                    <Card>
                      <Card.Header>
                        <h2 className="font-semibold text-sm">Mensajes</h2>
                      </Card.Header>
                      <Card.Content className="grid grid-cols-3 gap-3">
                        <MetricPill
                          subtitle="total"
                          title="Enviados"
                          tone="primary"
                          value={stats.sent + stats.delivered + stats.read + stats.played}
                        />
                        <MetricPill
                          subtitle="total"
                          title="Entregados"
                          tone="success"
                          value={stats.delivered + stats.read + stats.played}
                        />
                        <MetricPill
                          subtitle="total"
                          title="Leídos"
                          tone="accent"
                          value={stats.read + stats.played}
                        />
                        {stats.pending > 0 && (
                          <MetricPill
                            subtitle="total"
                            title="Pendientes"
                            tone="warning"
                            value={stats.pending}
                          />
                        )}
                        {stats.failed > 0 && (
                          <MetricPill
                            subtitle="total"
                            title="Fallidos"
                            tone="warning"
                            value={stats.failed}
                          />
                        )}
                      </Card.Content>
                    </Card>
                  )}
              </div>
            )}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="consent">
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Registrar consentimiento</h2>
                <Description className="text-default-500 text-xs">
                  Usa esto para marcar manualmente un número como opt-in u opt-out.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setConsentPhone} value={consentPhone}>
                  <Input placeholder="+56912345678" type="tel" />
                </TextField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    isDisabled={consentMutation.isPending || !consentPhone.trim()}
                    isPending={consentMutation.isPending}
                    onPress={() =>
                      consentMutation.mutate({ phone: consentPhone, status: "OPTED_IN" })
                    }
                    size="sm"
                    variant="primary"
                  >
                    Marcar opt-in
                  </Button>
                  <Button
                    isDisabled={consentMutation.isPending || !consentPhone.trim()}
                    onPress={() =>
                      consentMutation.mutate({ phone: consentPhone, status: "OPTED_OUT" })
                    }
                    size="sm"
                    variant="secondary"
                  >
                    Marcar opt-out
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MetricPill
                    subtitle="contactos"
                    title="Opt-in"
                    tone="success"
                    value={overview?.optedInContacts ?? 0}
                  />
                  <MetricPill
                    subtitle="contactos"
                    title="Opt-out"
                    tone="warning"
                    value={overview?.optedOutContacts ?? 0}
                  />
                  <MetricPill
                    subtitle="contactos"
                    title="Sin estado"
                    tone="accent"
                    value={overview?.unknownConsentContacts ?? 0}
                  />
                </div>

                <Description className="text-default-500 text-xs">
                  Los inbound messages y calls pueden auto-marcar opt-in si
                  WHATSAPP_AUTO_OPT_IN_ON_INBOUND está activo.
                </Description>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Contactos conocidos</h2>
                <Description className="text-default-500 text-xs">
                  Estado de consentimiento, última actividad y expiración de ventana por teléfono.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setContactSearch} value={contactSearch}>
                  <Input placeholder="Buscar por teléfono o wa_id" type="search" />
                </TextField>

                {contactsPending ? (
                  <Skeleton className="h-64 w-full rounded-2xl" />
                ) : contactsData?.contacts.length ? (
                  <div className="grid gap-3">
                    {contactsData.contacts.map((contact) => (
                      <Surface
                        key={contact.phone}
                        className="rounded-2xl border border-default-200 px-4 py-3"
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-sm">{contact.phone}</p>
                              <Chip
                                color={
                                  contact.optInStatus === "OPTED_IN"
                                    ? "success"
                                    : contact.optInStatus === "OPTED_OUT"
                                      ? "danger"
                                      : "warning"
                                }
                                size="sm"
                                variant="soft"
                              >
                                {contact.optInStatus}
                              </Chip>
                            </div>
                            <Description className="text-default-500 text-xs">
                              wa_id: {contact.waId ?? "—"} · fuente: {contact.optInSource ?? "—"}
                            </Description>
                            <Description className="text-default-500 text-xs">
                              Último inbound:{" "}
                              {contact.lastInboundAt
                                ? dayjs(contact.lastInboundAt).format("DD/MM/YYYY HH:mm")
                                : "—"}
                              {" · "}
                              Última llamada:{" "}
                              {contact.lastInboundCallAt
                                ? dayjs(contact.lastInboundCallAt).format("DD/MM/YYYY HH:mm")
                                : "—"}
                            </Description>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              onPress={() => {
                                setConsentPhone(contact.phone);
                                consentMutation.mutate({
                                  phone: contact.phone,
                                  status: "OPTED_IN",
                                });
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              Opt-in
                            </Button>
                            <Button
                              onPress={() => {
                                setConsentPhone(contact.phone);
                                consentMutation.mutate({
                                  phone: contact.phone,
                                  status: "OPTED_OUT",
                                });
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              Opt-out
                            </Button>
                          </div>
                        </div>
                      </Surface>
                    ))}
                  </div>
                ) : (
                  <Alert status="default">No hay contactos registrados todavía.</Alert>
                )}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="testing">
          <div className="mt-4 max-w-xl">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Enviar mensaje de prueba</h2>
                <Description className="text-default-500 text-xs">
                  Envía un mensaje de texto de prueba al número indicado.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setTestPhone} value={testPhone}>
                  <Input placeholder="+56912345678" type="tel" />
                </TextField>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    isDisabled={testMutation.isPending || !testPhone.trim() || !connected}
                    isPending={testMutation.isPending}
                    onPress={() => testMutation.mutate()}
                    size="sm"
                    variant="primary"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </Button>
                  {!connected ? (
                    <Chip color="danger" size="sm" variant="soft">
                      Sin conexión
                    </Chip>
                  ) : null}
                </div>

                {!connected ? (
                  <Alert status="warning">
                    WhatsApp no está conectado. Ve a la pestaña Canal para vincular el dispositivo.
                  </Alert>
                ) : null}

                {testMutation.data ? (
                  <Alert status={testMutation.data.status === "ok" ? "success" : "danger"}>
                    {testMutation.data.message}
                  </Alert>
                ) : null}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}

function MetricPill({
  subtitle,
  title,
  tone,
  value,
}: {
  subtitle: string;
  title: string;
  tone: "accent" | "primary" | "success" | "warning";
  value: number | string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    accent: "border-accent/20 bg-accent/8 text-accent",
    primary: "border-primary/20 bg-primary/8 text-primary",
    success: "border-success/20 bg-success/8 text-success",
    warning: "border-warning/20 bg-warning/8 text-warning",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone]}`}>
      <Description className="text-[11px] uppercase tracking-wide opacity-75">{title}</Description>
      <div className="mt-1 truncate font-semibold text-base">{value}</div>
      <Description className="text-[11px] opacity-75">{subtitle}</Description>
    </div>
  );
}
