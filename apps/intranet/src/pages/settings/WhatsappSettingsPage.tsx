import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Skeleton,
  Surface,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { CheckCheck, MessageCircleReply, Send, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

import { useToast } from "@/context/ToastContext";
import {
  sendWhatsappCustomMessage,
  sendWhatsappTest,
  setWhatsappContactConsent,
} from "@/features/whatsapp/api";
import { whatsappKeys } from "@/features/whatsapp/queries";
import { PAGE_CONTAINER } from "@/lib/styles";

type MediaKind = "audio" | "document" | "image" | "sticker" | "video";

const MEDIA_KIND_OPTIONS: Array<{ label: string; value: MediaKind }> = [
  { label: "Imagen", value: "image" },
  { label: "Audio", value: "audio" },
  { label: "Documento", value: "document" },
  { label: "Video", value: "video" },
  { label: "Sticker", value: "sticker" },
];

export function WhatsappSettingsPage() {
  const { error: showError, success: showSuccess } = useToast();
  const queryClient = useQueryClient();
  const [consentPhone, setConsentPhone] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [opsPhone, setOpsPhone] = useState("");
  const [opsMessageId, setOpsMessageId] = useState("");
  const [opsReplyBody, setOpsReplyBody] = useState("");
  const [opsReactionEmoji, setOpsReactionEmoji] = useState("");
  const [mediaKind, setMediaKind] = useState<"" | MediaKind>("");
  const [mediaPhone, setMediaPhone] = useState("");
  const [mediaLink, setMediaLink] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaFilename, setMediaFilename] = useState("");

  const { data: overview, isPending: overviewPending } = useQuery({
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

  const customMutation = useMutation({
    mutationFn: sendWhatsappCustomMessage,
    onError: (err: Error) => showError(`Error al ejecutar la operación: ${err.message}`),
    onSuccess: (result) => {
      if (result.status === "ok") {
        showSuccess(result.message, "Operación enviada");
      } else {
        showError(result.message, "Operación rechazada");
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: whatsappKeys.overview().queryKey }),
        queryClient.invalidateQueries({ queryKey: ["whatsapp", "contacts"] }),
      ]);
    },
  });

  const { data: stats } = useQuery({
    ...whatsappKeys.stats(),
    refetchInterval: 30_000,
  });

  const connected = connectionStatus?.connectionState === "open";
  const connecting = connectionStatus?.connectionState === "connecting";
  const actionResult = customMutation.data;

  const handleContextualReply = () => {
    customMutation.mutate({
      body: opsReplyBody,
      kind: "contextual_text",
      phone: opsPhone,
      quotedMessageId: opsMessageId,
    });
  };

  const handleReaction = () => {
    customMutation.mutate({
      emoji: opsReactionEmoji,
      kind: "reaction",
      messageId: opsMessageId,
      phone: opsPhone,
    });
  };

  const handleMarkRead = () => {
    customMutation.mutate({
      kind: "mark_read",
      messageId: opsMessageId,
      phone: opsPhone,
    });
  };

  const handleTypingIndicator = () => {
    customMutation.mutate({
      kind: "typing",
      phone: opsPhone,
    });
  };

  const handleMediaSend = () => {
    if (!mediaKind) {
      showError("Selecciona un tipo de media.");
      return;
    }

    customMutation.mutate({
      caption: mediaCaption || undefined,
      filename: mediaFilename || undefined,
      kind: mediaKind,
      link: mediaLink,
      phone: mediaPhone,
    });
  };

  return (
    <div className={PAGE_CONTAINER}>
      <Tabs defaultSelectedKey="channel">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Secciones de WhatsApp">
            <Tabs.Tab id="channel">
              Canal
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="operations">
              Operaciones
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
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Conexión WhatsApp</h2>
                <Description className="text-default-500 text-xs">
                  Conexión directa vía Baileys. Escanea el código QR para vincular.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="flex items-center gap-3">
                  {connected ? (
                    <Wifi className="h-5 w-5 text-success" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-danger" />
                  )}
                  <Chip
                    color={connected ? "success" : connecting ? "warning" : "danger"}
                    size="sm"
                    variant="soft"
                  >
                    {connected ? "Conectado" : connecting ? "Conectando..." : "Desconectado"}
                  </Chip>
                  {connectionStatus?.lastDisconnectReason != null && !connected ? (
                    <Description className="text-default-500 text-xs">
                      Desconexión: código {connectionStatus.lastDisconnectReason}
                    </Description>
                  ) : null}
                </div>

                {!connected && connectionStatus?.qrDataUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      alt="QR code para vincular WhatsApp"
                      className="h-64 w-64 rounded-xl border border-default-200"
                      src={connectionStatus.qrDataUrl}
                    />
                    <Description className="text-center text-default-500 text-xs">
                      Abre WhatsApp en tu teléfono, ve a Dispositivos vinculados y escanea este
                      código. Se actualiza automáticamente cada ~60s.
                    </Description>
                  </div>
                ) : null}

                {connected ? (
                  <Alert status="success">WhatsApp conectado y listo para enviar mensajes.</Alert>
                ) : null}

                {overviewPending ? (
                  <Skeleton className="h-16 w-full rounded-2xl" />
                ) : overview ? (
                  <div className="space-y-2">
                    <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                      Flujo automático
                    </Description>
                    <div className="flex flex-wrap gap-2">
                      <Chip
                        color={overview.automaticFlowReady ? "success" : "warning"}
                        size="sm"
                        variant="soft"
                      >
                        {overview.automaticFlowReady ? "Listo" : "No listo"}
                      </Chip>
                      <Chip
                        color={overview.imapReady ? "success" : "default"}
                        size="sm"
                        variant="soft"
                      >
                        IMAP {overview.imapReady ? "OK" : "sin configurar"}
                      </Chip>
                      <Chip
                        color={overview.automaticNotificationsEnabled ? "success" : "default"}
                        size="sm"
                        variant="soft"
                      >
                        Notificaciones {overview.automaticNotificationsEnabled ? "ON" : "OFF"}
                      </Chip>
                    </div>
                  </div>
                ) : null}
              </Card.Content>
            </Card>

            {stats ? (
              <Card>
                <Card.Header className="flex flex-col items-start gap-1">
                  <h2 className="font-semibold text-base">Mensajes</h2>
                  <Description className="text-default-500 text-xs">
                    Estadísticas en tiempo real desde la base de datos.
                  </Description>
                </Card.Header>
                <Card.Content className="grid gap-3 sm:grid-cols-3">
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
                  <MetricPill
                    subtitle="total"
                    title="Pendientes"
                    tone="warning"
                    value={stats.pending}
                  />
                  <MetricPill
                    subtitle="total"
                    title="Fallidos"
                    tone="warning"
                    value={stats.failed}
                  />
                  <MetricPill
                    subtitle="total"
                    title="Reproducidos"
                    tone="success"
                    value={stats.played}
                  />
                </Card.Content>
              </Card>
            ) : null}
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="operations">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Reply y estado del chat</h2>
                <Description className="text-default-500 text-xs">
                  Herramientas para responder sobre un mensaje previo o actualizar su estado.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setOpsPhone} value={opsPhone}>
                  <Input placeholder="+56912345678" type="tel" />
                </TextField>

                <TextField className="w-full" onChange={setOpsMessageId} value={opsMessageId}>
                  <Input placeholder="Message ID" type="text" />
                </TextField>

                <TextField className="w-full">
                  <TextArea
                    onChange={(event) => setOpsReplyBody(event.target.value)}
                    placeholder="Texto de la respuesta contextual"
                    rows={4}
                    value={opsReplyBody}
                    variant="secondary"
                  />
                </TextField>

                <TextField
                  className="w-full"
                  onChange={setOpsReactionEmoji}
                  value={opsReactionEmoji}
                >
                  <Input placeholder="Emoji" type="text" />
                </TextField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    isDisabled={
                      customMutation.isPending ||
                      !opsPhone.trim() ||
                      !opsMessageId.trim() ||
                      !opsReplyBody.trim()
                    }
                    isPending={customMutation.isPending}
                    onPress={handleContextualReply}
                    size="sm"
                    variant="primary"
                  >
                    <MessageCircleReply className="h-4 w-4" />
                    Reply contextual
                  </Button>
                  <Button
                    isDisabled={
                      customMutation.isPending || !opsPhone.trim() || !opsMessageId.trim()
                    }
                    onPress={handleMarkRead}
                    size="sm"
                    variant="secondary"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark as read
                  </Button>
                  <Button
                    isDisabled={customMutation.isPending || !opsPhone.trim()}
                    onPress={handleTypingIndicator}
                    size="sm"
                    variant="secondary"
                  >
                    Typing
                  </Button>
                  <Button
                    isDisabled={
                      customMutation.isPending ||
                      !opsPhone.trim() ||
                      !opsMessageId.trim() ||
                      !opsReactionEmoji.trim()
                    }
                    onPress={handleReaction}
                    size="sm"
                    variant="secondary"
                  >
                    Reacción
                  </Button>
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Media por link</h2>
                <Description className="text-default-500 text-xs">
                  Soporta image, audio, document, video y sticker.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[220px_1fr]">
                  <Select
                    onChange={(value) => setMediaKind(value as "" | MediaKind)}
                    value={mediaKind}
                  >
                    <Label>Tipo media</Label>
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {MEDIA_KIND_OPTIONS.map((option) => (
                          <ListBox.Item id={option.value} key={option.value}>
                            {option.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <TextField className="w-full" onChange={setMediaPhone} value={mediaPhone}>
                    <Input placeholder="+56912345678" type="tel" />
                  </TextField>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                  <TextField className="w-full" onChange={setMediaLink} value={mediaLink}>
                    <Input placeholder="https://..." type="url" />
                  </TextField>
                  <TextField className="w-full" onChange={setMediaFilename} value={mediaFilename}>
                    <Input placeholder="archivo.pdf" type="text" />
                  </TextField>
                </div>

                <TextField className="w-full">
                  <TextArea
                    onChange={(event) => setMediaCaption(event.target.value)}
                    placeholder="Caption opcional"
                    rows={3}
                    value={mediaCaption}
                    variant="secondary"
                  />
                </TextField>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    isDisabled={customMutation.isPending || !mediaPhone.trim() || !mediaLink.trim()}
                    isPending={customMutation.isPending}
                    onPress={handleMediaSend}
                    size="sm"
                    variant="primary"
                  >
                    <Send className="h-4 w-4" />
                    Enviar media
                  </Button>
                </div>

                {actionResult ? (
                  <Alert status={actionResult.status === "ok" ? "success" : "danger"}>
                    {actionResult.message}
                  </Alert>
                ) : null}
              </Card.Content>
            </Card>
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
