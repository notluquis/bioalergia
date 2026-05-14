// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { Avatar, Button, Card, Chip, Spinner } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Ban, Bell, BellOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { confirmAction } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast-interceptor";
import { ChatBubble } from "./ChatBubble";
import { CommerceSelectorModal } from "./CommerceSelectorModal";
import {
  ContactsSendModal,
  ConvSettingsMenu,
  EditTextModal,
  FlowSelectorModal,
  InteractiveListSelectorModal,
  LabelStrip,
  LocationSelectorModal,
  MediaGalleryModal,
  ScheduleSendModal,
  TextComposer,
} from "./ConversationParts";
import { QualityBadge } from "./QualityBadge";
import { type CarouselCardState, type CopyCodeState, TemplateComposer } from "./TemplateComposer";
import { dayLabel, initialsOf, type MessageStatus } from "./_shared";
import { useQualityAlerts } from "../hooks/useQualityAlerts";
import {
  uploadWaMedia,
  useAccounts,
  useBlockContact,
  useCancelScheduled,
  useConversation,
  useEditText,
  useListScheduled,
  useScheduleMessage,
  useSendContacts,
  useSendMedia,
  useSendReaction,
  useSendSnippet,
  useSendTemplate,
  useSendText,
  useSetTyping,
  useTemplates,
  useUnblockContact,
  useSetMute,
  useUpdateConversation,
} from "../hooks/useWaCloud";

export function ConversationDetail({ conversationId }: { conversationId: number }) {
  const qc = useQueryClient();
  const conv = useConversation(conversationId);
  const accounts = useAccounts();
  const sendText = useSendText();
  const sendTemplate = useSendTemplate();
  const sendReaction = useSendReaction();
  const sendMedia = useSendMedia();
  const sendContacts = useSendContacts();
  const sendSnippet = useSendSnippet();
  const editText = useEditText();
  const setTyping = useSetTyping();
  const blockContact = useBlockContact();
  const unblockContactMut = useUnblockContact();
  const [flowOpen, setFlowOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    messageId: number;
    body: string;
  } | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [commerceOpen, setCommerceOpen] = useState(false);
  const scheduleMsg = useScheduleMessage();
  const cancelScheduled = useCancelScheduled();
  const scheduledList = useListScheduled(conversationId);
  const updateConv = useUpdateConversation();
  const setMute = useSetMute();
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [replyTo, setReplyTo] = useState<{
    metaMessageId: string;
    snippet: string;
    out: boolean;
  } | null>(null);

  const [body, setBody] = useState("");
  const [phoneId, setPhoneId] = useState<string>("");
  const [mode, setMode] = useState<"text" | "template">("text");
  const [tplKey, setTplKey] = useState("");
  const [tplVars, setTplVars] = useState<string[]>([]);
  // Carousel template state — array of cards with image + per-card body vars
  const [tplCards, setTplCards] = useState<CarouselCardState[]>([]);
  // LTO + COPY_CODE per-template state. Detected from selected template's
  // components (see useEffect below); operator fills the values at send time.
  const [tplLtoExpiration, setTplLtoExpiration] = useState<string>("");
  const [tplCopyCode, setTplCopyCode] = useState<CopyCodeState>(null);
  const [hasLto, setHasLto] = useState(false);
  const [copyCodeButtonIndex, setCopyCodeButtonIndex] = useState<number | null>(null);
  // Optimistic outbound messages keyed by client id, removed when refetch
  // brings the real message back.
  type Pending = {
    cid: string;
    body: string;
    timestamp: Date;
    status: "PENDING" | "FAILED";
  };
  const [pending, setPending] = useState<Pending[]>([]);

  const accountByPhone = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of accounts.data?.accounts ?? []) {
      for (const p of a.phoneNumbers) map.set(p.id, a.id);
    }
    return map;
  }, [accounts.data]);
  const activeAccountId = phoneId ? accountByPhone.get(Number.parseInt(phoneId, 10)) : undefined;
  const templates = useTemplates(activeAccountId);
  // Surface toast when quality drops to RED or new critical events arrive.
  useQualityAlerts(phoneId ? Number.parseInt(phoneId, 10) : undefined);

  const allPhones = useMemo(
    () => (accounts.data?.accounts ?? []).flatMap((a) => a.phoneNumbers),
    [accounts.data]
  );
  const phoneOptions = allPhones.map((p) => ({
    value: String(p.id),
    label: `${p.label ?? p.displayPhoneNumber}`,
  }));
  const tplOptions = useMemo(
    () => [
      { value: "", label: activeAccountId ? "—" : "Selecciona un número primero" },
      ...(templates.data?.templates ?? [])
        .filter((t) => t.status === "APPROVED")
        .map((t) => ({
          value: `${t.id}|${t.name}|${t.language}`,
          label: `${t.name} (${t.language})`,
        })),
    ],
    [templates.data, activeAccountId]
  );

  useEffect(() => setTplKey(""), [activeAccountId]);

  useEffect(() => {
    if (!phoneId && conv.data?.channels[0]) {
      setPhoneId(String(conv.data.channels[0].phoneNumberId));
    }
  }, [conv.data, phoneId]);

  useEffect(() => {
    if (!conv.data) return;
    setMode(conv.data.windowOpen ? "text" : "template");
  }, [conv.data?.windowOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!tplKey) {
      setTplVars([]);
      setTplCards([]);
      setHasLto(false);
      setCopyCodeButtonIndex(null);
      setTplLtoExpiration("");
      setTplCopyCode(null);
      return;
    }
    const tpl = templates.data?.templates.find((t) => `${t.id}|${t.name}|${t.language}` === tplKey);
    if (!tpl) return;
    type TplBtn = { type?: string };
    type TplComp = {
      type: string;
      text?: string;
      cards?: Array<{ components?: Array<{ type: string; text?: string }> }>;
      buttons?: TplBtn[];
    };
    const components = tpl.components as Array<TplComp>;
    const tplBody = components.find((c) => c.type === "BODY" || c.type === "body");
    const matches = tplBody?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
    setTplVars(new Array(matches.length).fill(""));

    // Carousel detection (Meta 2026): top-level component type=CAROUSEL with
    // cards[]. Each card's BODY has its own variables.
    const carousel = components.find((c) => c.type === "CAROUSEL" || c.type === "carousel");
    if (carousel?.cards?.length) {
      setTplCards(
        carousel.cards.map((card, idx) => {
          const cardBody = card.components?.find((c) => c.type === "BODY" || c.type === "body");
          const cardMatches = cardBody?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
          return {
            cardIndex: idx,
            imageMediaId: null,
            imageFilename: null,
            bodyParams: new Array(cardMatches.length).fill(""),
          };
        })
      );
    } else {
      setTplCards([]);
    }

    // LIMITED_TIME_OFFER detection
    const lto = components.some(
      (c) => c.type === "LIMITED_TIME_OFFER" || c.type === "limited_time_offer"
    );
    setHasLto(lto);
    setTplLtoExpiration("");

    // COPY_CODE button detection — find the index of the button in the
    // BUTTONS component (Meta orders by buttons[] array). Only one
    // copy_code per template is supported in our UI.
    const buttonsComp = components.find((c) => c.type === "BUTTONS" || c.type === "buttons");
    const copyIdx =
      buttonsComp?.buttons?.findIndex((b) => (b.type ?? "").toUpperCase() === "COPY_CODE") ?? -1;
    setCopyCodeButtonIndex(copyIdx >= 0 ? copyIdx : null);
    setTplCopyCode(null);
  }, [tplKey, templates.data]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = conv.data?.messages.length ?? 0;
  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [messageCount, pending.length]);

  // Drop pending entries once the real refetch includes a message with a
  // matching clientId (we tag via context.clientId in templateName? No — we
  // simply drop a pending entry when its body shows up as the most-recent
  // OUTBOUND in server data). Conservative cleanup: when pending older than
  // 30s and no longer at the bottom, remove.
  useEffect(() => {
    if (pending.length === 0 || !conv.data) return;
    const serverBodies = new Set(
      conv.data.messages.filter((m) => m.direction === "OUTBOUND").map((m) => m.body)
    );
    setPending((prev) => prev.filter((p) => p.status === "FAILED" || !serverBodies.has(p.body)));
  }, [conv.data, pending.length]);

  if (conv.isLoading || !conv.data) {
    return (
      <Card.Content className="flex h-full items-center justify-center">
        <Spinner aria-label="Cargando" />
      </Card.Content>
    );
  }
  const c = conv.data;
  const contactName = c.contact.name ?? c.contact.pushName ?? c.contact.phoneE164;
  const initials = initialsOf(contactName);

  const handleSendText = () => {
    if (!body.trim() || !phoneId) return;
    const text = body.trim();
    const cid = `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const pn = Number.parseInt(phoneId, 10);
    const ctxId = replyTo?.metaMessageId;
    setBody("");
    setReplyTo(null);
    setPending((p) => [...p, { cid, body: text, timestamp: new Date(), status: "PENDING" }]);
    sendText.mutate(
      {
        conversationId,
        phoneNumberId: pn,
        body: text,
        ...(ctxId ? { contextMetaMessageId: ctxId } : {}),
      },
      {
        onSuccess: () => {
          void qc.invalidateQueries({ queryKey: ["wa-cloud", "conversation", conversationId] });
        },
        onError: (err) => {
          setPending((p) => p.map((it) => (it.cid === cid ? { ...it, status: "FAILED" } : it)));
          toast.error(err instanceof Error ? err.message : "Error al enviar mensaje");
        },
      }
    );
  };

  const handleReact = (metaMessageId: string, emoji: string) => {
    if (!phoneId) return;
    sendReaction.mutate({
      conversationId,
      phoneNumberId: Number.parseInt(phoneId, 10),
      metaMessageId,
      emoji,
    });
  };

  const handleAttachFile = async (file: File) => {
    if (!phoneId) {
      toast.error("Selecciona un número primero");
      return;
    }
    const pn = Number.parseInt(phoneId, 10);
    const mime = file.type || "application/octet-stream";
    let type: "image" | "document" | "audio" | "video" | "sticker" = "document";
    if (mime.startsWith("image/")) type = mime === "image/webp" ? "sticker" : "image";
    else if (mime.startsWith("video/")) type = "video";
    else if (mime.startsWith("audio/")) type = "audio";
    try {
      toast.info("Subiendo archivo…");
      const upload = await uploadWaMedia(file, pn);
      await sendMedia.mutateAsync({
        conversationId,
        phoneNumberId: pn,
        type,
        mediaId: upload.id,
        caption: body.trim() || undefined,
        filename: type === "document" ? file.name : undefined,
        ...(replyTo?.metaMessageId ? { contextMetaMessageId: replyTo.metaMessageId } : {}),
      });
      setBody("");
      setReplyTo(null);
      toast.success("Archivo enviado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir archivo");
    }
  };

  const handleSendTemplate = async () => {
    if (!tplKey || !phoneId) return;
    const [, name, language] = tplKey.split("|");
    if (!name || !language) return;
    try {
      // Validate carousel cards have images when applicable
      if (tplCards.length > 0) {
        const missingImg = tplCards.filter((c) => !c.imageMediaId);
        if (missingImg.length > 0) {
          toast.error(
            `Sube imagen para tarjeta(s): ${missingImg.map((c) => c.cardIndex + 1).join(", ")}`
          );
          return;
        }
      }
      // LTO validation: if template requires expiration, must be set + future
      let ltoMs: number | undefined;
      if (hasLto) {
        if (!tplLtoExpiration) {
          toast.error("Define la fecha/hora de expiración LTO");
          return;
        }
        ltoMs = new Date(tplLtoExpiration).getTime();
        if (!Number.isFinite(ltoMs) || ltoMs < Date.now() + 60_000) {
          toast.error("LTO debe expirar al menos 1 minuto en el futuro");
          return;
        }
      }
      // COPY_CODE validation
      if (copyCodeButtonIndex !== null && (!tplCopyCode?.value || !tplCopyCode.value.trim())) {
        toast.error("Ingresa el código para el botón Copiar código");
        return;
      }
      await sendTemplate.mutateAsync({
        conversationId,
        phoneNumberId: Number.parseInt(phoneId, 10),
        templateName: name,
        language,
        bodyParams: tplVars.length ? tplVars : undefined,
        cards: tplCards.length
          ? tplCards.map((c) => ({
              cardIndex: c.cardIndex,
              imageMediaId: c.imageMediaId ?? undefined,
              bodyParams: c.bodyParams.length ? c.bodyParams : undefined,
            }))
          : undefined,
        ...(ltoMs ? { ltoExpirationMs: ltoMs } : {}),
        ...(tplCopyCode ? { copyCodeButton: tplCopyCode } : {}),
      });
      setTplKey("");
      setTplVars([]);
      setTplCards([]);
      setTplLtoExpiration("");
      setTplCopyCode(null);
      toast.success("Plantilla enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar plantilla");
    }
  };

  // Build a unified, day-grouped feed (server messages + pending).
  type ReactionInfo = { emoji: string; out: boolean };
  type Row =
    | { kind: "divider"; key: string; label: string }
    | {
        kind: "message";
        key: string;
        messageId: number | null;
        metaMessageId: string | null;
        out: boolean;
        body: string | null;
        type: string;
        timestamp: Date;
        status: MessageStatus;
        errorTitle?: string | null;
        errorDetails?: string | null;
        templateName?: string | null;
        quotedSnippet?: { body: string; out: boolean } | null;
        reactions?: ReactionInfo[];
        payload?: unknown;
      };

  // Index server messages by metaMessageId so we can resolve quoted replies.
  const byMetaId = new Map<string, (typeof c.messages)[number]>();
  for (const m of c.messages) {
    if (m.metaMessageId) byMetaId.set(m.metaMessageId, m);
  }
  // Group REACTION messages by their target metaMessageId so they can render
  // as floating chips on the original bubble (and not as standalone rows).
  const reactionsByTarget = new Map<string, ReactionInfo[]>();
  for (const m of c.messages) {
    if (m.type === "REACTION" && m.contextMetaMessageId) {
      const arr = reactionsByTarget.get(m.contextMetaMessageId) ?? [];
      // Empty body = reaction removed; skip
      if (m.body && m.body.trim()) {
        arr.push({ emoji: m.body.trim(), out: m.direction === "OUTBOUND" });
        reactionsByTarget.set(m.contextMetaMessageId, arr);
      }
    }
  }

  const allMessages: Row[] = [];
  let lastDay = "";
  const serverMsgs = c.messages
    .filter((m) => m.type !== "REACTION")
    .map((m) => ({ ...m, _src: "server" as const }));
  const pendingMsgs = pending.map((p) => ({
    id: p.cid,
    direction: "OUTBOUND" as const,
    body: p.body,
    type: "TEXT",
    timestamp: p.timestamp,
    status: p.status,
    errorTitle: null,
    errorDetails: null,
    templateName: null,
    metaMessageId: null,
    contextMetaMessageId: null,
    _src: "pending" as const,
  }));
  type Combined = (typeof serverMsgs)[number] | (typeof pendingMsgs)[number];
  const combined: Combined[] = [...serverMsgs, ...pendingMsgs].sort(
    (a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)
  );
  for (const m of combined) {
    const d = dayjs(m.timestamp);
    const day = d.format("YYYY-MM-DD");
    if (day !== lastDay) {
      allMessages.push({ kind: "divider", key: `d-${day}`, label: dayLabel(d) });
      lastDay = day;
    }
    let quoted: { body: string; out: boolean } | null = null;
    if (m.contextMetaMessageId) {
      const target = byMetaId.get(m.contextMetaMessageId);
      if (target) {
        quoted = {
          body: target.body ?? `[${target.type.toLowerCase()}]`,
          out: target.direction === "OUTBOUND",
        };
      }
    }
    allMessages.push({
      kind: "message",
      key: `${m._src}-${m.id}`,
      messageId: m._src === "server" ? Number(m.id) : null,
      metaMessageId: m.metaMessageId ?? null,
      out: m.direction === "OUTBOUND",
      body: m.body,
      type: m.type,
      timestamp: new Date(m.timestamp),
      status: m.status as MessageStatus,
      errorTitle: m.errorTitle,
      errorDetails: m.errorDetails,
      templateName: m.templateName,
      quotedSnippet: quoted,
      reactions: m.metaMessageId ? reactionsByTarget.get(m.metaMessageId) : undefined,
      payload: "payload" in m ? (m as { payload?: unknown }).payload : undefined,
    });
  }

  return (
    <>
      <Card.Header className="!flex !flex-row !items-center !justify-between gap-3 border-default-200 border-b p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-10 shrink-0 bg-success/15 text-success">
            <Avatar.Fallback delayMs={0} className="font-semibold text-sm">
              {initials}
            </Avatar.Fallback>
          </Avatar>
          <div className="min-w-0" data-phi>
            <p className="truncate font-medium text-base">{contactName}</p>
            <p className="truncate text-default-500 text-xs">
              {c.contact.phoneE164}
              {c.contact.patientRut && ` · RUT ${c.contact.patientRut}`}
            </p>
          </div>
        </div>
        {/* On mobile the chip stack can overflow the header; scroll it
            horizontally instead of wrapping so the chat title stays
            on its own line. */}
        <div className="-mx-1 flex shrink-0 items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {c.contact.blockedAt && (
            <Chip color="danger" variant="soft" size="sm">
              <Ban size={12} />
              <Chip.Label>Bloqueado</Chip.Label>
            </Chip>
          )}
          {c.windowOpen ? (
            <Chip color="success" variant="soft" size="sm">
              <Chip.Label>
                Ventana {c.windowExpiresAt && dayjs(c.windowExpiresAt).fromNow(true)}
              </Chip.Label>
            </Chip>
          ) : (
            <Chip color="warning" variant="soft" size="sm">
              <Chip.Label>Ventana cerrada · solo plantilla</Chip.Label>
            </Chip>
          )}
          <QualityBadge phoneNumberId={phoneId ? Number.parseInt(phoneId, 10) : undefined} />
          {(() => {
            const mu = c.conversation.mutedUntil;
            const isMuted = mu ? new Date(mu).getTime() > Date.now() : false;
            return (
              <Button
                size="sm"
                variant={isMuted ? "secondary" : "ghost"}
                isPending={setMute.isPending}
                isDisabled={setMute.isPending}
                onPress={() =>
                  setMute.mutate({
                    conversationId,
                    // Toggle: muted → unmute; unmuted → far-future mute
                    // (year 9999 = effectively permanent until toggled).
                    mutedUntil: isMuted ? null : "9999-12-31T23:59:59.000Z",
                  })
                }
                aria-label={isMuted ? "Activar push" : "Silenciar push"}
              >
                {isMuted ? <BellOff size={14} /> : <Bell size={14} />}
              </Button>
            );
          })()}
          <ConvSettingsMenu
            conversationId={conversationId}
            phoneId={phoneId}
            phoneOptions={phoneOptions}
            onPhoneChange={setPhoneId}
            onOpenGallery={() => setGalleryOpen(true)}
            onRelease={() => updateConv.mutate({ id: conversationId, assignedToUserId: null })}
            onBlock={async () => {
              if (!phoneId) {
                toast.error("Selecciona un número primero");
                return;
              }
              const ok = await confirmAction({
                title: "Bloquear contacto",
                description: "El contacto no podrá enviarte mensajes hasta que lo desbloquees.",
                confirmLabel: "Bloquear",
                variant: "danger",
              });
              if (!ok) return;
              blockContact.mutate({
                conversationId,
                phoneNumberId: Number(phoneId),
              });
            }}
            blockPending={blockContact.isPending}
          />
        </div>
      </Card.Header>

      <LabelStrip
        labels={c.conversation.etiquetas}
        onChange={(next) => updateConv.mutate({ id: conversationId, etiquetas: next })}
      />

      <Card.Content className="flex flex-1 flex-col overflow-hidden p-0">
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-content2 px-4 py-3">
          {allMessages.length === 0 ? (
            <p className="py-8 text-center text-default-400 text-sm">
              Sin mensajes aún en esta conversación.
            </p>
          ) : (
            allMessages.map((row) =>
              row.kind === "divider" ? (
                <div key={row.key} className="flex justify-center py-2">
                  <Chip size="sm" variant="soft">
                    <Chip.Label>{row.label}</Chip.Label>
                  </Chip>
                </div>
              ) : (
                <ChatBubble
                  key={row.key}
                  row={row}
                  onReply={(r) =>
                    setReplyTo({
                      metaMessageId: r.metaMessageId!,
                      snippet: r.body ?? `[${r.type.toLowerCase()}]`,
                      out: r.out,
                    })
                  }
                  onReact={(r, emoji) => handleReact(r.metaMessageId!, emoji)}
                  onEdit={(r) => setEditTarget({ messageId: r.messageId!, body: r.body ?? "" })}
                />
              )
            )
          )}
        </div>

        {c.contact.blockedAt && (
          <div className="flex items-center justify-between gap-3 border-default-200 border-t bg-danger-50 px-4 py-2 text-danger text-sm">
            <span className="flex items-center gap-2">
              <Ban size={14} />
              Contacto bloqueado · no puedes enviar mensajes hasta desbloquearlo
            </span>
            <Button
              size="sm"
              variant="outline"
              onPress={async () => {
                if (!phoneId) {
                  toast.error("Selecciona un número primero");
                  return;
                }
                const ok = await confirmAction({
                  title: "Desbloquear contacto",
                  description: "Volverá a poder enviarte mensajes en WhatsApp.",
                  confirmLabel: "Desbloquear",
                });
                if (!ok) return;
                blockContact.reset();
                void unblockContactMut
                  .mutateAsync({
                    conversationId,
                    phoneNumberId: Number(phoneId),
                  })
                  .then(() => {
                    toast.success("Contacto desbloqueado");
                  })
                  .catch((e) => toast.error(`Error: ${String(e)}`));
              }}
            >
              Desbloquear
            </Button>
          </div>
        )}
        <div className="border-default-200 border-t bg-background p-3">
          {mode === "text" ? (
            <TextComposer
              body={body}
              setBody={(v) => {
                setBody(v);
                if (typingDebounce.current) clearTimeout(typingDebounce.current);
                typingDebounce.current = setTimeout(() => {
                  if (v.trim().length > 0) {
                    setTyping.mutate(conversationId);
                  }
                }, 400);
              }}
              onSend={handleSendText}
              isDisabled={!c.windowOpen || !phoneId || Boolean(c.contact.blockedAt)}
              disabledReason={
                c.contact.blockedAt
                  ? "Contacto bloqueado"
                  : !c.windowOpen
                    ? "Ventana 24h cerrada. Cambia a plantilla."
                    : !phoneId
                      ? "Selecciona un número en ⚙ ajustes"
                      : null
              }
              onSwitchTemplate={() => setMode("template")}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              onAttachFile={handleAttachFile}
              attachPending={sendMedia.isPending}
              onOpenFlow={() => setFlowOpen(true)}
              onOpenLocation={() => setLocationOpen(true)}
              onOpenContacts={() => setContactsOpen(true)}
              onOpenSchedule={() => setScheduleOpen(true)}
              onOpenList={() => setListOpen(true)}
              onOpenCommerce={() => setCommerceOpen(true)}
              onSendSnippet={(snippetId) => {
                if (!phoneId) {
                  toast.error("Selecciona un número primero");
                  return;
                }
                sendSnippet.mutate(
                  { conversationId, phoneNumberId: Number(phoneId), snippetId },
                  {
                    onError: (e) => toast.error(`Error: ${String(e)}`),
                  }
                );
              }}
            />
          ) : (
            <TemplateComposer
              tplKey={tplKey}
              setTplKey={setTplKey}
              tplOptions={tplOptions}
              tplVars={tplVars}
              setTplVars={setTplVars}
              tplCards={tplCards}
              setTplCards={setTplCards}
              tplLtoExpiration={tplLtoExpiration}
              setTplLtoExpiration={setTplLtoExpiration}
              tplCopyCode={tplCopyCode}
              setTplCopyCode={setTplCopyCode}
              hasLto={hasLto}
              copyCodeButtonIndex={copyCodeButtonIndex}
              phoneId={phoneId}
              isPending={sendTemplate.isPending}
              onSend={handleSendTemplate}
              onSwitchText={c.windowOpen ? () => setMode("text") : undefined}
            />
          )}
        </div>
      </Card.Content>
      <FlowSelectorModal
        isOpen={flowOpen}
        onClose={() => setFlowOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
      />
      <LocationSelectorModal
        isOpen={locationOpen}
        onClose={() => setLocationOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
      />
      <ContactsSendModal
        isOpen={contactsOpen}
        onClose={() => setContactsOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
        onSend={(input) => sendContacts.mutate(input)}
        isPending={sendContacts.isPending}
      />
      <EditTextModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
        onSubmit={(input) => editText.mutate(input)}
        isPending={editText.isPending}
      />
      <MediaGalleryModal
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        conversationId={conversationId}
      />
      <InteractiveListSelectorModal
        isOpen={listOpen}
        onClose={() => setListOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
      />
      <CommerceSelectorModal
        isOpen={commerceOpen}
        onClose={() => setCommerceOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
      />
      <ScheduleSendModal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
        defaultBody={body}
        scheduled={scheduledList.data?.scheduled ?? []}
        onSchedule={(input) =>
          scheduleMsg.mutate(input, {
            onSuccess: () => {
              toast.success("Mensaje programado");
              setBody("");
            },
            onError: (e) => toast.error(`Error: ${String(e)}`),
          })
        }
        onCancel={(id) => cancelScheduled.mutate(id)}
        isPending={scheduleMsg.isPending}
      />
    </>
  );
}
