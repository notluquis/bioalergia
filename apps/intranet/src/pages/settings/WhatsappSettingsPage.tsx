import {
  Alert,
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Link,
  ListBox,
  ProgressBar,
  Select,
  Skeleton,
  Surface,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  BadgeInfo,
  CheckCheck,
  MessageCircleReply,
  MessagesSquare,
  Send,
  ShieldCheck,
  SquareArrowOutUpRight,
  Webhook,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useToast } from "@/context/ToastContext";
import {
  sendWhatsappCustomMessage,
  sendWhatsappTest,
  setWhatsappContactConsent,
} from "@/features/whatsapp/api";
import { whatsappKeys } from "@/features/whatsapp/queries";
import { PAGE_CONTAINER } from "@/lib/styles";
import { ChecklistRow, FlowStep, ReadyChip } from "./messaging-settings-shared";

type InteractiveKind = "cta_url" | "list" | "reply_buttons";
type MediaKind = "audio" | "document" | "image" | "sticker" | "video";

const INTERACTIVE_KIND_OPTIONS: Array<{ label: string; value: InteractiveKind }> = [
  { label: "CTA URL", value: "cta_url" },
  { label: "Reply buttons", value: "reply_buttons" },
  { label: "Lista", value: "list" },
];

const MEDIA_KIND_OPTIONS: Array<{ label: string; value: MediaKind }> = [
  { label: "Imagen", value: "image" },
  { label: "Audio", value: "audio" },
  { label: "Documento", value: "document" },
  { label: "Video", value: "video" },
  { label: "Sticker", value: "sticker" },
];

function parseReplyButtons(raw: string) {
  const buttons = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, title] = line.split("|").map((segment) => segment?.trim());
      if (!id || !title) {
        throw new Error(
          "Cada botón debe ir en una línea con el formato id|Título. Ejemplo: confirmar|Confirmar"
        );
      }
      return { id, title };
    });

  if (buttons.length === 0) {
    throw new Error("Debes definir al menos un botón.");
  }

  return buttons;
}

function parseInteractiveSections(raw: string) {
  try {
    const parsed = JSON.parse(raw) as Array<{
      rows: Array<{ description?: string; id: string; title: string }>;
      title: string;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Debes enviar un arreglo JSON con al menos una sección.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Sections inválidas: ${error.message}`);
    }
    throw new Error("Sections inválidas: JSON no válido.");
  }
}

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
  const [interactiveKind, setInteractiveKind] = useState<"" | InteractiveKind>("");
  const [interactivePhone, setInteractivePhone] = useState("");
  const [interactiveBody, setInteractiveBody] = useState("");
  const [interactiveHeader, setInteractiveHeader] = useState("");
  const [interactiveFooter, setInteractiveFooter] = useState("");
  const [interactiveCtaText, setInteractiveCtaText] = useState("");
  const [interactiveCtaUrl, setInteractiveCtaUrl] = useState("");
  const [interactiveButtons, setInteractiveButtons] = useState("");
  const [interactiveButtonText, setInteractiveButtonText] = useState("");
  const [interactiveSections, setInteractiveSections] = useState("");
  const [mediaKind, setMediaKind] = useState<"" | MediaKind>("");
  const [mediaPhone, setMediaPhone] = useState("");
  const [mediaLink, setMediaLink] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaFilename, setMediaFilename] = useState("");
  const [mediaReplyTo, setMediaReplyTo] = useState("");

  const { data: overview, isPending: overviewPending } = useQuery({
    ...whatsappKeys.overview(),
    refetchInterval: 30_000,
  });

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

  const readiness = useMemo(() => {
    if (!overview) return 0;
    const checks = [
      overview.accessTokenConfigured,
      overview.phoneNumberIdConfigured,
      overview.webhookVerifyTokenConfigured,
      overview.appSecretConfigured,
      Boolean(overview.templateName && overview.templateLanguage),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [overview]);

  const missingBlocks = useMemo(() => {
    if (!overview) return [];
    const items: string[] = [];
    if (!overview.accessTokenConfigured) items.push("access token");
    if (!overview.phoneNumberIdConfigured) items.push("phone number ID");
    if (!overview.webhookVerifyTokenConfigured) items.push("verify token");
    if (!overview.appSecretConfigured) items.push("app secret");
    if (!overview.templateName || !overview.templateLanguage) items.push("template fallback");
    return items;
  }, [overview]);

  const templateFallbackReady = Boolean(overview?.templateName && overview?.templateLanguage);

  const testModeLabel =
    testMutation.data?.mode === "text"
      ? "Texto libre"
      : testMutation.data?.mode === "template"
        ? "Template"
        : null;

  const capabilityCards = [
    {
      description: "Respuesta citando el mensaje original.",
      ready: overview?.supportsContextualReplies ?? false,
      title: "Contextual replies",
    },
    {
      description: "Mark as read y typing indicator.",
      ready: Boolean(overview?.supportsMarkAsRead && overview?.supportsTypingIndicator),
      title: "Read + typing",
    },
    {
      description: "Imagen, audio, documento, video y sticker.",
      ready: overview?.supportsMedia ?? false,
      title: "Media",
    },
    {
      description: "CTA URL, botones y listas.",
      ready: overview?.supportsInteractive ?? false,
      title: "Interactive",
    },
    {
      description: "Emoji sobre mensajes inbound previos.",
      ready: overview?.supportsReactions ?? false,
      title: "Reactions",
    },
    {
      description: "Llamadas inbound refrescan la ventana de 24h.",
      ready: overview?.supportsCalls ?? false,
      title: "Calls",
    },
  ];

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
    });
  };

  const handleTypingIndicator = () => {
    customMutation.mutate({
      kind: "typing",
      messageId: opsMessageId,
    });
  };

  const handleInteractiveSend = () => {
    if (!interactiveKind) {
      showError("Selecciona un tipo de mensaje interactivo.");
      return;
    }

    if (interactiveKind === "cta_url") {
      customMutation.mutate({
        body: interactiveBody,
        displayText: interactiveCtaText,
        footer: interactiveFooter || undefined,
        headerText: interactiveHeader || undefined,
        kind: "cta_url",
        phone: interactivePhone,
        url: interactiveCtaUrl,
      });
      return;
    }

    if (interactiveKind === "reply_buttons") {
      try {
        customMutation.mutate({
          body: interactiveBody,
          buttons: parseReplyButtons(interactiveButtons),
          footer: interactiveFooter || undefined,
          headerText: interactiveHeader || undefined,
          kind: "reply_buttons",
          phone: interactivePhone,
        });
      } catch (error) {
        showError(error instanceof Error ? error.message : "No se pudo parsear los botones.");
      }
      return;
    }

    try {
      customMutation.mutate({
        body: interactiveBody,
        buttonText: interactiveButtonText,
        footer: interactiveFooter || undefined,
        headerText: interactiveHeader || undefined,
        kind: "list",
        phone: interactivePhone,
        sections: parseInteractiveSections(interactiveSections),
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : "No se pudo parsear las secciones.");
    }
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
      replyToMessageId: mediaReplyTo || undefined,
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
            <Tabs.Tab id="webhook">
              Webhook
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="messages">
              Mensajería
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
                <h2 className="font-semibold text-base">Estado del canal</h2>
                <Description className="text-default-500 text-xs">
                  Esto cubre sólo WhatsApp Cloud API: credenciales, número y webhook.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                {overviewPending ? (
                  <Skeleton className="h-72 w-full rounded-2xl" />
                ) : overview ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Description className="text-default-500 text-xs uppercase tracking-wide">
                          Preparación del canal
                        </Description>
                        <span className="font-semibold text-sm">{readiness}%</span>
                      </div>
                      <ProgressBar aria-label="Preparación del canal" value={readiness}>
                        <ProgressBar.Track className="h-2 rounded-full bg-default-100">
                          <ProgressBar.Fill className="bg-primary" />
                        </ProgressBar.Track>
                      </ProgressBar>
                    </div>

                    <ChecklistRow
                      description="Token permanente válido con permisos para enviar mensajes por la Cloud API."
                      icon={ShieldCheck}
                      ready={overview.accessTokenConfigured}
                      title="Access token"
                    />
                    <ChecklistRow
                      description="Phone Number ID real del número conectado a WhatsApp Business."
                      icon={MessagesSquare}
                      ready={overview.phoneNumberIdConfigured}
                      title="Phone Number ID"
                    />
                    <ChecklistRow
                      description="Verify token configurado para la verificación inicial del webhook."
                      icon={Webhook}
                      ready={overview.webhookVerifyTokenConfigured}
                      title="Verify token"
                    />
                    <ChecklistRow
                      description="App Secret presente para validar la firma x-hub-signature-256."
                      icon={ShieldCheck}
                      ready={overview.appSecretConfigured}
                      title="Firma de webhook"
                    />
                    <ChecklistRow
                      description="Template configurado para envíos fuera de ventana de 24 horas."
                      icon={Send}
                      ready={templateFallbackReady}
                      title="Template fallback"
                    />
                  </>
                ) : (
                  <Alert status="danger">No se pudo cargar el estado de WhatsApp.</Alert>
                )}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Capacidades implementadas</h2>
                <Description className="text-default-500 text-xs">
                  Lo que hoy soporta el repo según la API interna y el contrato oRPC.
                </Description>
              </Card.Header>
              <Card.Content className="grid gap-3 sm:grid-cols-2">
                {capabilityCards.map((item) => (
                  <Surface
                    key={item.title}
                    className="rounded-2xl border border-default-200 px-4 py-3"
                  >
                    <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                      {item.title}
                    </Description>
                    <div className="mt-2">
                      <ReadyChip value={item.ready} />
                    </div>
                    <Description className="mt-2 text-default-500 text-xs">
                      {item.description}
                    </Description>
                  </Surface>
                ))}
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="webhook">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Flujo inbound del webhook</h2>
                <Description className="text-default-500 text-xs">
                  El webhook verifica firma, recibe eventos del canal y actualiza conversación,
                  consentimiento y estados salientes.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                <FlowStep
                  body="Meta valida el callback con verify token y luego firma los POST con App Secret."
                  icon={Webhook}
                  step="01"
                  title="Verificación y firma"
                />
                <FlowStep
                  body="Los eventos `messages` y `calls` entrantes abren o refrescan la ventana de 24 horas."
                  icon={MessageCircleReply}
                  step="02"
                  title="Inbound actualiza la ventana"
                />
                <FlowStep
                  body="Los eventos `statuses` actualizan sent, delivered, read o failed sobre mensajes salientes."
                  icon={BadgeInfo}
                  step="03"
                  title="Statuses actualizan trazabilidad"
                />
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Notas operativas</h2>
                <Description className="text-default-500 text-xs">
                  Alcance real del handler respecto a la plataforma.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Sí procesa
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    `messages[]`, `statuses[]`, `calls[]` y `user_preferences[]`
                  </p>
                  <Description className="text-default-500 text-xs">
                    Con eso sincroniza opt-in, expiración de ventana, conversación y delivery state.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Observabilidad extra
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    `played` y `unsupported messages` ya no se pierden
                  </p>
                  <Description className="text-default-500 text-xs">
                    Los voice messages reproducidos quedan registrados y los inbound no soportados
                    se loguean para diagnóstico.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    No procesa todavía
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    address, contacts, location, flows y voice-call outbound
                  </p>
                  <Description className="text-default-500 text-xs">
                    Esos quedan fuera del scope actual y no fueron parte de los hallazgos
                    priorizados.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Ventanas activas
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {overview?.activeCustomerServiceWindows ?? 0}
                  </p>
                  <Description className="text-default-500 text-xs">
                    La expiración usa `conversation.expiration_timestamp` cuando Meta lo entrega y
                    cae a actividad + 24h como respaldo.
                  </Description>
                </Surface>
              </Card.Content>
            </Card>
          </div>
        </Tabs.Panel>

        <Tabs.Panel id="messages">
          <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Regla de 24 horas</h2>
                <Description className="text-default-500 text-xs">
                  Esto es lo que el canal hace hoy para mantenerse dentro de las reglas de Meta.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Fuera de ventana
                  </Description>
                  <p className="mt-1 font-medium text-sm">Template + consentimiento obligatorio</p>
                  <Description className="text-default-500 text-xs">
                    Si no hay ventana activa y no existe opt-in, el backend bloquea el envío.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Ventana abierta
                  </Description>
                  <p className="mt-1 font-medium text-sm">Texto libre y operaciones avanzadas</p>
                  <Description className="text-default-500 text-xs">
                    Respuestas contextuales, reacciones, interactive y media se habilitan cuando hay
                    ventana activa.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Normalización
                  </Description>
                  <p className="mt-1 font-medium text-sm">Se intenta enviar en E.164</p>
                  <Description className="text-default-500 text-xs">
                    Hoy la normalización está optimizada principalmente para números chilenos.
                  </Description>
                </Surface>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Cumplimiento actual</h2>
                <Description className="text-default-500 text-xs">
                  Qué quedó cubierto frente a los hallazgos contra la documentación de envío.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                {!overviewPending && overview && missingBlocks.length > 0 ? (
                  <Alert status="warning">
                    El canal no está completo todavía. Falta: {missingBlocks.join(", ")}.
                  </Alert>
                ) : null}

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Resuelto
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Opt-in, inbound por llamadas, Graph API{" "}
                    {overview?.graphApiVersion ?? "sin definir"}, parseo enriquecido y expiración
                    canónica de ventana.
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    También agregado
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Mark as read, typing, replies contextuales, reacciones, media e interactive vía
                    API interna.
                  </p>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Sigue fuera
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    No se implementó el catálogo completo de Meta: address, contacts, location,
                    flows y voice-call outbound.
                  </p>
                </Surface>
              </Card.Content>
            </Card>
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
                  <Input placeholder="wamid.HBgL..." type="text" />
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
                    isDisabled={customMutation.isPending || !opsMessageId.trim()}
                    onPress={handleMarkRead}
                    size="sm"
                    variant="secondary"
                  >
                    <CheckCheck className="h-4 w-4" />
                    Mark as read
                  </Button>
                  <Button
                    isDisabled={customMutation.isPending || !opsMessageId.trim()}
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

                <Description className="text-default-500 text-xs">
                  Las acciones ligadas al número requieren ventana activa. `mark_read` y `typing`
                  sólo necesitan el `message_id`.
                </Description>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Interactive</h2>
                <Description className="text-default-500 text-xs">
                  CTA URL, reply buttons y listas sobre el mismo endpoint interno.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <Select
                  onChange={(value) => setInteractiveKind(value as "" | InteractiveKind)}
                  value={interactiveKind}
                >
                  <Label>Tipo interactivo</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {INTERACTIVE_KIND_OPTIONS.map((option) => (
                        <ListBox.Item id={option.value} key={option.value}>
                          {option.label}
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <TextField
                  className="w-full"
                  onChange={setInteractivePhone}
                  value={interactivePhone}
                >
                  <Input placeholder="+56912345678" type="tel" />
                </TextField>

                <TextField className="w-full">
                  <TextArea
                    onChange={(event) => setInteractiveBody(event.target.value)}
                    placeholder="Cuerpo del mensaje"
                    rows={4}
                    value={interactiveBody}
                    variant="secondary"
                  />
                </TextField>

                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    className="w-full"
                    onChange={setInteractiveHeader}
                    value={interactiveHeader}
                  >
                    <Input placeholder="Header opcional" type="text" />
                  </TextField>
                  <TextField
                    className="w-full"
                    onChange={setInteractiveFooter}
                    value={interactiveFooter}
                  >
                    <Input placeholder="Footer opcional" type="text" />
                  </TextField>
                </div>

                {interactiveKind === "cta_url" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField
                      className="w-full"
                      onChange={setInteractiveCtaText}
                      value={interactiveCtaText}
                    >
                      <Input placeholder="Texto del botón" type="text" />
                    </TextField>
                    <TextField
                      className="w-full"
                      onChange={setInteractiveCtaUrl}
                      value={interactiveCtaUrl}
                    >
                      <Input placeholder="https://bioalergia.cl" type="url" />
                    </TextField>
                  </div>
                ) : null}

                {interactiveKind === "reply_buttons" ? (
                  <TextField className="w-full">
                    <TextArea
                      onChange={(event) => setInteractiveButtons(event.target.value)}
                      placeholder="id|Título"
                      rows={5}
                      value={interactiveButtons}
                      variant="secondary"
                    />
                  </TextField>
                ) : null}

                {interactiveKind === "list" ? (
                  <>
                    <TextField
                      className="w-full"
                      onChange={setInteractiveButtonText}
                      value={interactiveButtonText}
                    >
                      <Input placeholder="Texto del botón de lista" type="text" />
                    </TextField>
                    <TextField className="w-full">
                      <TextArea
                        className="font-mono text-xs"
                        onChange={(event) => setInteractiveSections(event.target.value)}
                        placeholder="JSON de sections"
                        rows={8}
                        value={interactiveSections}
                        variant="secondary"
                      />
                    </TextField>
                  </>
                ) : null}

                <Button
                  isDisabled={
                    customMutation.isPending ||
                    !interactivePhone.trim() ||
                    !interactiveBody.trim() ||
                    (interactiveKind === "cta_url" &&
                      (!interactiveCtaText.trim() || !interactiveCtaUrl.trim()))
                  }
                  isPending={customMutation.isPending}
                  onPress={handleInteractiveSend}
                  size="sm"
                  variant="primary"
                >
                  <Send className="h-4 w-4" />
                  Enviar interactive
                </Button>
              </Card.Content>
            </Card>

            <Card className="xl:col-span-2">
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Media por link o media ID</h2>
                <Description className="text-default-500 text-xs">
                  Esta operación usa la ventana activa y soporta `image`, `audio`, `document`,
                  `video` y `sticker`.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[220px_1fr_1fr]">
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

                  <TextField className="w-full" onChange={setMediaReplyTo} value={mediaReplyTo}>
                    <Input placeholder="Reply to message ID opcional" type="text" />
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
                  <Description className="text-default-500 text-xs">
                    Si usas documento, `filename` es opcional pero recomendable.
                  </Description>
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
                  Usa esto para marcar manualmente un número como `opt-in` u `opt-out` cuando el
                  consentimiento exista fuera de WhatsApp.
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
                  Los inbound messages y calls pueden auto-marcar `opt-in` si
                  `WHATSAPP_AUTO_OPT_IN_ON_INBOUND` está activo.
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
                            <Description className="text-default-500 text-xs">
                              Ventana expira:{" "}
                              {contact.windowExpiresAt
                                ? dayjs(contact.windowExpiresAt).format("DD/MM/YYYY HH:mm")
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
          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Enviar mensaje de prueba</h2>
                <Description className="text-default-500 text-xs">
                  El backend decide al enviar: texto libre si el número tiene ventana activa; si no,
                  template.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-4">
                <TextField className="w-full" onChange={setTestPhone} value={testPhone}>
                  <Input placeholder="+56912345678" type="tel" />
                </TextField>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    isDisabled={testMutation.isPending || !testPhone.trim()}
                    isPending={testMutation.isPending}
                    onPress={() => testMutation.mutate()}
                    size="sm"
                    variant="primary"
                  >
                    <Send className="h-4 w-4" />
                    Enviar
                  </Button>
                  {testModeLabel ? (
                    <Chip
                      color={testMutation.data?.mode === "text" ? "accent" : "default"}
                      variant="soft"
                    >
                      {testModeLabel}
                    </Chip>
                  ) : null}
                </div>

                <Description className="text-default-500 text-xs">
                  Si el número ya respondió o llamó por WhatsApp en las últimas 24 horas, el test
                  sale como texto. Si no, usa el template configurado.
                </Description>

                {!templateFallbackReady ? (
                  <Alert status="warning">
                    El fallback por template no está configurado. Define `WHATSAPP_TEMPLATE_NAME` y
                    `WHATSAPP_TEMPLATE_LANGUAGE` antes de probar envíos fuera de ventana.
                  </Alert>
                ) : null}

                {testMutation.data ? (
                  <Alert status={testMutation.data.status === "ok" ? "success" : "danger"}>
                    {testMutation.data.message}
                  </Alert>
                ) : null}
              </Card.Content>
            </Card>

            <Card>
              <Card.Header className="flex flex-col items-start gap-1">
                <h2 className="font-semibold text-base">Referencias</h2>
                <Description className="text-default-500 text-xs">
                  Puntos clave para validar el canal y las reglas de envío.
                </Description>
              </Card.Header>
              <Card.Content className="space-y-3">
                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Sending messages
                  </Description>
                  <Link
                    className="mt-1 inline-flex items-center gap-1 font-medium text-primary text-sm"
                    href="https://developers.facebook.com/docs/whatsapp/cloud-api/"
                    rel="noreferrer"
                    target="_blank"
                  >
                    WhatsApp Cloud API
                    <SquareArrowOutUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Sandbox
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Con número de prueba no puedes enviar a cualquiera
                  </p>
                  <Description className="text-default-500 text-xs">
                    El destinatario tiene que estar habilitado o registrado en el entorno de test.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Consentimiento
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    {overview?.optInRequired
                      ? "Se exige opt-in fuera de ventana"
                      : "Opt-in desactivado por configuración"}
                  </p>
                  <Description className="text-default-500 text-xs">
                    Si el número no tiene ventana activa y tampoco opt-in, el envío de prueba se
                    bloquea.
                  </Description>
                </Surface>

                <Surface className="rounded-2xl border border-default-200 px-4 py-3">
                  <Description className="font-semibold text-[11px] text-default-400 uppercase tracking-wide">
                    Formato recomendado
                  </Description>
                  <p className="mt-1 font-medium text-sm">
                    Usa E.164 con código país y prefijo `+`
                  </p>
                  <Description className="text-default-500 text-xs">
                    Evita ambigüedad de país al probar o enviar desde la API.
                  </Description>
                </Surface>
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
