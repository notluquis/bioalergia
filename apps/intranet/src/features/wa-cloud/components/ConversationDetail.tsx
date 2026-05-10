import {
  Avatar,
  Button,
  Calendar,
  Card,
  Chip,
  DateField,
  DatePicker,
  Description,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Popover,
  Spinner,
  TextArea,
} from "@heroui/react";
import {
  type CalendarDateTime,
  getLocalTimeZone,
  now,
  type ZonedDateTime,
} from "@internationalized/date";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  AlertCircle,
  Ban,
  CalendarClock,
  Check,
  CheckCheck,
  Clock,
  Contact as ContactIcon,
  CornerUpLeft,
  Download,
  FileText,
  Images,
  Layers,
  List,
  MapPin,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings2,
  Smile,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { EmojiPickerButton } from "./EmojiPickerButton";
import { MediaAttachment } from "./MediaAttachment";
import {
  ContactsBubble,
  ForwardedBadge,
  InteractiveBubble,
  LocationBubble,
  UnsupportedBubble,
} from "./SpecialMessage";
import {
  uploadWaMedia,
  useAccounts,
  useBlockContact,
  useUnblockContact,
  useCancelScheduled,
  useListScheduled,
  useScheduleMessage,
  useConversation,
  useConversationMedia,
  useEditText,
  useSavedFlows,
  useSavedInteractiveLists,
  useSavedLocations,
  useSendContacts,
  useSendMedia,
  useSendReaction,
  useSendSavedFlow,
  useSendSavedList,
  useSendSavedLocation,
  useSendTemplate,
  useSendText,
  useSetTyping,
  useTemplates,
  useUpdateConversation,
} from "../hooks/useWaCloud";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING";

function StatusTicks({ status }: { status: MessageStatus }) {
  const cls = "inline-block";
  if (status === "PENDING") return <Clock className={cls} size={14} aria-label="enviando" />;
  if (status === "FAILED")
    return <AlertCircle className={`${cls} text-danger`} size={14} aria-label="falló" />;
  if (status === "READ")
    return <CheckCheck className={`${cls} text-accent`} size={14} aria-label="leído" />;
  if (status === "DELIVERED")
    return <CheckCheck className={cls} size={14} aria-label="entregado" />;
  return <Check className={cls} size={14} aria-label="enviado" />;
}

function dayLabel(d: dayjs.Dayjs): string {
  const today = dayjs();
  if (d.isSame(today, "day")) return "Hoy";
  if (d.isSame(today.subtract(1, "day"), "day")) return "Ayer";
  if (d.isAfter(today.subtract(7, "day"))) return d.format("dddd");
  return d.format("DD MMM YYYY");
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ConversationDetail({ conversationId }: { conversationId: number }) {
  const qc = useQueryClient();
  const conv = useConversation(conversationId);
  const accounts = useAccounts();
  const sendText = useSendText();
  const sendTemplate = useSendTemplate();
  const sendReaction = useSendReaction();
  const sendMedia = useSendMedia();
  const sendContacts = useSendContacts();
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
  const scheduleMsg = useScheduleMessage();
  const cancelScheduled = useCancelScheduled();
  const scheduledList = useListScheduled(conversationId);
  const updateConv = useUpdateConversation();
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
      return;
    }
    const tpl = templates.data?.templates.find((t) => `${t.id}|${t.name}|${t.language}` === tplKey);
    if (!tpl) return;
    const tplBody = (tpl.components as Array<{ type: string; text?: string }>).find(
      (c) => c.type === "BODY" || c.type === "body"
    );
    const matches = tplBody?.text?.match(/\{\{(\d+)\}\}/g) ?? [];
    setTplVars(new Array(matches.length).fill(""));
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
        <Spinner />
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
      await sendTemplate.mutateAsync({
        conversationId,
        phoneNumberId: Number.parseInt(phoneId, 10),
        templateName: name,
        language,
        bodyParams: tplVars.length ? tplVars : undefined,
      });
      setTplKey("");
      setTplVars([]);
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
          <Avatar className="size-10 shrink-0 bg-success-200 text-success-900">
            <Avatar.Fallback className="font-semibold text-sm">{initials}</Avatar.Fallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium text-base">{contactName}</p>
            <p className="truncate text-default-500 text-xs">
              {c.contact.phoneE164}
              {c.contact.patientRut && ` · RUT ${c.contact.patientRut}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          <ConvSettingsMenu
            conversationId={conversationId}
            phoneId={phoneId}
            phoneOptions={phoneOptions}
            onPhoneChange={setPhoneId}
            onOpenGallery={() => setGalleryOpen(true)}
            onRelease={() => updateConv.mutate({ id: conversationId, assignedToUserId: null })}
            onBlock={() => {
              if (!phoneId) {
                toast.error("Selecciona un número primero");
                return;
              }
              if (!confirm("¿Bloquear este contacto en WhatsApp? No podrá enviarte mensajes."))
                return;
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
              onPress={() => {
                if (!phoneId) {
                  toast.error("Selecciona un número primero");
                  return;
                }
                if (!confirm("¿Desbloquear este contacto en WhatsApp?")) return;
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
            />
          ) : (
            <TemplateComposer
              tplKey={tplKey}
              setTplKey={setTplKey}
              tplOptions={tplOptions}
              tplVars={tplVars}
              setTplVars={setTplVars}
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

function ChatBubble({
  row,
  onReply,
  onReact,
  onEdit,
}: {
  row: {
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
    reactions?: { emoji: string; out: boolean }[];
    payload?: unknown;
  };
  onReply: (row: {
    metaMessageId: string | null;
    body: string | null;
    type: string;
    out: boolean;
  }) => void;
  onReact: (row: { metaMessageId: string | null; out: boolean }, emoji: string) => void;
  onEdit: (row: { messageId: number | null; body: string | null }) => void;
}) {
  const out = row.out;
  const isPending = row.status === "PENDING";
  const failed = row.status === "FAILED";
  const wrapper = out ? "justify-end" : "justify-start";
  const canInteract = row.metaMessageId !== null;
  // 100% HeroUI semantic tokens. Outbound uses success (clinic green),
  // inbound uses content1 (raised surface), failed uses danger.
  const isSticker = row.type === "STICKER";
  const bubbleColor = isSticker
    ? "bg-transparent"
    : out
      ? failed
        ? "bg-danger text-danger-foreground"
        : "bg-success text-success-foreground"
      : "bg-content1 text-foreground border border-default-200";
  const radius = isSticker
    ? ""
    : out
      ? "rounded-l-2xl rounded-tr-2xl"
      : "rounded-r-2xl rounded-tl-2xl";
  const isMedia = ["IMAGE", "STICKER", "VIDEO", "AUDIO", "DOCUMENT"].includes(row.type);
  const fallbackLabel = row.templateName
    ? `[plantilla] ${row.templateName}`
    : `[${row.type.toLowerCase()}]`;

  const actions = canInteract ? (
    <div
      className={`absolute top-1 ${out ? "right-full mr-1" : "left-full ml-1"} flex gap-1 opacity-0 transition pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto`}
    >
      <Popover>
        <Popover.Trigger>
          <Button size="sm" variant="outline" isIconOnly aria-label="Reaccionar">
            <Smile size={14} />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="rounded-full border border-default-200 bg-content1 px-1 py-1 shadow-md">
          <Popover.Dialog className="flex gap-0.5 p-0">
            {QUICK_REACTIONS.map((e) => (
              <Button
                key={e}
                size="sm"
                variant="outline"
                isIconOnly
                aria-label={`Reaccionar ${e}`}
                onPress={() => onReact({ metaMessageId: row.metaMessageId, out }, e)}
                className="rounded-full border-0 text-lg"
              >
                {e}
              </Button>
            ))}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <Button
        size="sm"
        variant="outline"
        isIconOnly
        aria-label="Responder"
        onPress={() =>
          onReply({
            metaMessageId: row.metaMessageId,
            body: row.body,
            type: row.type,
            out,
          })
        }
      >
        <CornerUpLeft size={14} />
      </Button>
      {out &&
        row.type === "TEXT" &&
        row.messageId !== null &&
        Date.now() - row.timestamp.getTime() < 15 * 60 * 1000 && (
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            aria-label="Editar"
            onPress={() => onEdit({ messageId: row.messageId, body: row.body })}
          >
            <Pencil size={14} />
          </Button>
        )}
    </div>
  ) : null;

  return (
    <div className={`group relative flex ${wrapper}`}>
      <div
        className={`relative ${
          isSticker
            ? "max-w-[12rem]"
            : "w-fit max-w-[78%] min-w-[60px] lg:max-w-[480px]"
        }`}
      >
        {actions}
        <div
          className={`${radius} ${isSticker ? "" : "w-fit min-w-[60px] max-w-full px-3 py-2 shadow-sm"} ${bubbleColor} ${
            out ? "ml-auto" : "mr-auto"
          } ${isPending ? "opacity-70" : ""}`}
        >
          <ForwardedBadge payload={row.payload as Record<string, unknown> | null} />
          {row.quotedSnippet && (
            <div
              className={`mb-1 rounded border-l-4 px-2 py-1 text-xs ${row.quotedSnippet.out ? "border-l-accent bg-accent/10 text-accent-foreground/80" : "border-l-default-400 bg-default-100/40 text-default-700"}`}
            >
              <p className="line-clamp-2">{row.quotedSnippet.body}</p>
            </div>
          )}
          {row.type === "LOCATION" ? (
            <LocationBubble payload={row.payload as Record<string, unknown> | null} />
          ) : row.type === "CONTACTS" ? (
            <ContactsBubble payload={row.payload as Record<string, unknown> | null} />
          ) : row.type === "INTERACTIVE" ? (
            <InteractiveBubble
              payload={row.payload as Record<string, unknown> | null}
              body={row.body}
            />
          ) : row.type === "UNSUPPORTED" ? (
            <UnsupportedBubble payload={row.payload as Record<string, unknown> | null} />
          ) : isMedia && row.messageId ? (
            <MediaAttachment
              messageId={row.messageId}
              type={row.type}
              caption={row.body}
              out={out}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">
              {row.body ?? fallbackLabel}
            </p>
          )}
          <div
            className={`flex items-center justify-end gap-1 text-[10px] ${
              isSticker
                ? "mt-0.5 text-default-500"
                : out
                  ? "mt-1 text-success-foreground/80"
                  : "mt-1 text-default-500"
            }`}
          >
            <span>{dayjs(row.timestamp).format("HH:mm")}</span>
            {out && <StatusTicks status={row.status} />}
          </div>
          {failed && row.errorTitle && (
            <p className="mt-1 px-3 pb-1 text-[11px] text-danger">
              {row.errorTitle}
              {row.errorDetails ? `: ${row.errorDetails}` : ""}
            </p>
          )}
        </div>
        {row.reactions && row.reactions.length > 0 && (
          <div
            className={`absolute -bottom-2.5 ${out ? "right-2" : "left-2"} flex items-center gap-0.5 rounded-full bg-content1 px-1.5 py-0.5 shadow-sm ring-1 ring-default-200`}
          >
            {row.reactions.slice(0, 3).map((r, i) => (
              <span key={i} className="text-xs leading-none">
                {r.emoji}
              </span>
            ))}
            {row.reactions.length > 1 && (
              <span className="ml-0.5 text-[10px] text-default-500">{row.reactions.length}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TextComposer({
  body,
  setBody,
  onSend,
  isDisabled,
  disabledReason,
  onSwitchTemplate,
  replyTo,
  onCancelReply,
  onAttachFile,
  attachPending,
  onOpenFlow,
  onOpenLocation,
  onOpenContacts,
  onOpenSchedule,
  onOpenList,
}: {
  body: string;
  setBody: (v: string) => void;
  onSend: () => void;
  isDisabled: boolean;
  disabledReason: string | null;
  onSwitchTemplate: () => void;
  replyTo: { snippet: string; out: boolean } | null;
  onCancelReply: () => void;
  onAttachFile: (file: File) => void;
  attachPending: boolean;
  onOpenFlow: () => void;
  onOpenLocation: () => void;
  onOpenContacts: () => void;
  onOpenSchedule: () => void;
  onOpenList: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // auto-grow
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [body]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isDisabled) onSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = ref.current;
    if (!el) {
      setBody(body + emoji);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + emoji + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-2">
      {replyTo && (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-l-success bg-content2 px-3 py-2">
          <CornerUpLeft size={14} className="shrink-0 text-success" />
          <div className="min-w-0 flex-1">
            <p className="text-default-500 text-xs">
              Respondiendo a {replyTo.out ? "tu mensaje" : "el paciente"}
            </p>
            <p className="line-clamp-1 text-foreground text-sm">{replyTo.snippet}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            isIconOnly
            onPress={onCancelReply}
            aria-label="Cancelar respuesta"
          >
            <X size={14} />
          </Button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/*,video/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAttachFile(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex items-end gap-2">
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Cambiar a plantilla"
          onPress={onSwitchTemplate}
        >
          <FileText size={16} />
        </Button>
        <Dropdown>
          <Dropdown.Trigger>
            <Button
              size="sm"
              variant="outline"
              isIconOnly
              aria-label="Adjuntar"
              isDisabled={isDisabled || attachPending}
            >
              <Plus size={16} />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover className="w-56 p-1">
            <ListBox aria-label="Adjuntar opciones" className="space-y-0.5">
              <ListBox.Item
                id="file"
                onAction={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <Paperclip size={14} className="text-default-500" />
                <span>Archivo / foto / video</span>
              </ListBox.Item>
              <ListBox.Item
                id="location"
                onAction={onOpenLocation}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <MapPin size={14} className="text-success" />
                <span>Ubicación</span>
              </ListBox.Item>
              <ListBox.Item
                id="contact"
                onAction={onOpenContacts}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <ContactIcon size={14} className="text-accent" />
                <span>Contacto</span>
              </ListBox.Item>
              <ListBox.Item
                id="flow"
                onAction={onOpenFlow}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <Layers size={14} className="text-default-500" />
                <span>Formulario (Flow)</span>
              </ListBox.Item>
              <ListBox.Item
                id="list"
                onAction={onOpenList}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <List size={14} className="text-accent" />
                <span>Lista interactiva</span>
              </ListBox.Item>
              <ListBox.Item
                id="schedule"
                onAction={onOpenSchedule}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <CalendarClock size={14} className="text-warning" />
                <span>Programar mensaje</span>
              </ListBox.Item>
            </ListBox>
          </Dropdown.Popover>
        </Dropdown>
        <EmojiPickerButton onSelect={insertEmoji} />
        <VoiceRecorderButton onSend={onAttachFile} isDisabled={isDisabled || attachPending} />
        <div className="flex-1">
          <TextArea
            ref={ref}
            variant="secondary"
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            onKeyDown={handleKey}
            placeholder={
              isDisabled
                ? (disabledReason ?? "")
                : "Escribe un mensaje. Enter para enviar, Shift+Enter para nueva línea."
            }
            disabled={isDisabled}
            rows={1}
            className="w-full resize-none rounded-2xl"
            fullWidth
          />
        </div>
        <Button
          size="sm"
          isIconOnly
          aria-label="Enviar"
          onPress={onSend}
          isDisabled={isDisabled || !body.trim()}
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}

function TemplateComposer({
  tplKey,
  setTplKey,
  tplOptions,
  tplVars,
  setTplVars,
  isPending,
  onSend,
  onSwitchText,
}: {
  tplKey: string;
  setTplKey: (v: string) => void;
  tplOptions: { value: string; label: string }[];
  tplVars: string[];
  setTplVars: React.Dispatch<React.SetStateAction<string[]>>;
  isPending: boolean;
  onSend: () => void;
  onSwitchText?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <SelectInput
            label="Plantilla aprobada"
            value={tplKey}
            onValueChange={setTplKey}
            options={tplOptions}
          />
        </div>
        {onSwitchText && (
          <Button size="sm" variant="outline" onPress={onSwitchText}>
            Texto libre
          </Button>
        )}
      </div>
      {tplVars.length > 0 && (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {tplVars.map((v, i) => (
            <TextInput
              key={i}
              label={`Variable {{${i + 1}}}`}
              value={v}
              onValueChange={(val) =>
                setTplVars((arr) => {
                  const n = [...arr];
                  n[i] = val;
                  return n;
                })
              }
            />
          ))}
        </div>
      )}
      <div className="flex justify-end">
        <Button onPress={onSend} isPending={isPending} isDisabled={!tplKey}>
          <Send size={14} />
          Enviar plantilla
        </Button>
      </div>
    </div>
  );
}

function ConvSettingsMenu({
  conversationId,
  phoneId,
  phoneOptions,
  onPhoneChange,
  onRelease,
  onBlock,
  blockPending,
  onOpenGallery,
}: {
  conversationId: number;
  phoneId: string;
  phoneOptions: { value: string; label: string }[];
  onPhoneChange: (v: string) => void;
  onRelease: () => void;
  onBlock: () => void;
  blockPending: boolean;
  onOpenGallery: () => void;
}) {
  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button size="sm" variant="outline" isIconOnly aria-label="Ajustes conversación">
          <Settings2 size={16} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-72 p-3">
        <div className="space-y-3">
          <SelectInput
            label="Enviar desde"
            value={phoneId}
            onValueChange={onPhoneChange}
            options={phoneOptions}
          />
          <Button size="sm" variant="outline" fullWidth onPress={onOpenGallery}>
            <Images size={14} />
            Ver galería de medios
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`/api/wa-cloud/conversations/${conversationId}/export?format=txt`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" fullWidth>
                <Download size={14} />
                TXT
              </Button>
            </a>
            <a
              href={`/api/wa-cloud/conversations/${conversationId}/export?format=json`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" fullWidth>
                <Download size={14} />
                JSON
              </Button>
            </a>
          </div>
          <Button size="sm" variant="outline" fullWidth onPress={onRelease}>
            Liberar asignación
          </Button>
          <Button
            size="sm"
            variant="danger-soft"
            fullWidth
            onPress={onBlock}
            isPending={blockPending}
          >
            <Ban size={14} />
            Bloquear contacto
          </Button>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function ContactsSendModal({
  isOpen,
  onClose,
  conversationId,
  phoneNumberId,
  onSend,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
  onSend: (input: {
    conversationId: number;
    phoneNumberId: number;
    contacts: {
      name: { formatted_name: string; first_name?: string; last_name?: string };
      phones?: { phone: string; type?: string }[];
      emails?: { email: string; type?: string }[];
    }[];
  }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setPhone("");
      setEmail("");
    }
  }, [isOpen]);

  const submit = () => {
    if (!phoneNumberId) {
      toast.error("Selecciona un número primero");
      return;
    }
    if (!name.trim()) {
      toast.error("Nombre obligatorio");
      return;
    }
    const card = {
      name: { formatted_name: name.trim() },
      phones: phone.trim() ? [{ phone: phone.trim(), type: "CELL" }] : undefined,
      emails: email.trim() ? [{ email: email.trim(), type: "WORK" }] : undefined,
    };
    onSend({ conversationId, phoneNumberId, contacts: [card] });
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Compartir contacto
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <TextInput
                label="Nombre completo"
                value={name}
                onValueChange={setName}
                placeholder="Dra. Andrea Pulgar"
              />
              <TextInput
                label="Teléfono"
                value={phone}
                onValueChange={setPhone}
                placeholder="+56912345678"
              />
              <TextInput
                label="Email"
                value={email}
                onValueChange={setEmail}
                placeholder="contacto@bioalergia.cl"
              />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={submit} isPending={isPending}>
                <Send size={14} />
                Enviar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function LabelStrip({
  labels,
  onChange,
}: {
  labels: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (labels.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...labels, v]);
    setDraft("");
  };
  const remove = (l: string) => onChange(labels.filter((x) => x !== l));

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-default-200 border-b bg-content1 px-3 py-2">
      <Tag size={12} className="text-default-400" />
      {labels.length === 0 && <span className="text-default-400 text-xs">Sin etiquetas</span>}
      {labels.map((l) => (
        <Chip key={l} size="sm" color="accent" variant="soft">
          <Chip.Label>{l}</Chip.Label>
          <button
            type="button"
            onClick={() => remove(l)}
            className="ml-1 rounded-full hover:bg-accent-200/50"
            aria-label={`Quitar ${l}`}
          >
            <X size={10} />
          </button>
        </Chip>
      ))}
      <Popover>
        <Popover.Trigger>
          <Button size="sm" variant="outline" isIconOnly aria-label="Agregar etiqueta">
            <Plus size={12} />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="rounded-lg border border-default-200 bg-content1 p-2 shadow-md">
          <Popover.Dialog className="flex items-center gap-2 p-0">
            <TextInput
              label=""
              value={draft}
              onValueChange={setDraft}
              placeholder="nueva etiqueta"
            />
            <Button size="sm" onPress={add} isDisabled={!draft.trim()}>
              <Check size={12} />
              Agregar
            </Button>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}

function EditTextModal({
  target,
  onClose,
  conversationId,
  phoneNumberId,
  onSubmit,
  isPending,
}: {
  target: { messageId: number; body: string } | null;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
  onSubmit: (input: {
    conversationId: number;
    phoneNumberId: number;
    messageId: number;
    body: string;
  }) => void;
  isPending: boolean;
}) {
  const [body, setBody] = useState("");

  useEffect(() => {
    setBody(target?.body ?? "");
  }, [target]);

  const submit = () => {
    if (!target) return;
    if (!phoneNumberId) {
      toast.error("Selecciona un número primero");
      return;
    }
    if (!body.trim()) {
      toast.error("El mensaje no puede estar vacío");
      return;
    }
    onSubmit({
      conversationId,
      phoneNumberId,
      messageId: target.messageId,
      body: body.trim(),
    });
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={Boolean(target)}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Editar mensaje
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Solo dentro de los primeros 15 minutos. Cloud API limitará si excede.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <TextArea
                variant="secondary"
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                rows={4}
                fullWidth
              />
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cancelar
              </Button>
              <Button onPress={submit} isPending={isPending}>
                <Pencil size={14} />
                Guardar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function ScheduleSendModal({
  isOpen,
  onClose,
  conversationId,
  phoneNumberId,
  defaultBody,
  scheduled,
  onSchedule,
  onCancel,
  isPending,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
  defaultBody: string;
  scheduled: Array<{
    id: number;
    scheduledAt: Date;
    status: "PENDING" | "SENT" | "FAILED" | "CANCELLED";
    type: string;
    body: string | null;
    templateName: string | null;
    errorMessage: string | null;
  }>;
  onSchedule: (input: {
    conversationId: number;
    phoneNumberId: number;
    scheduledAt: Date;
    type: "TEXT";
    body: string;
  }) => void;
  onCancel: (id: number) => void;
  isPending: boolean;
}) {
  const tz = getLocalTimeZone();
  const minDt = now(tz).add({ minutes: 1 });
  const [when, setWhen] = useState<CalendarDateTime | ZonedDateTime>(minDt.add({ minutes: 4 }));
  const [body, setBody] = useState(defaultBody);

  useEffect(() => {
    if (isOpen) {
      setBody(defaultBody);
      setWhen(now(tz).add({ minutes: 5 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const submit = () => {
    if (!phoneNumberId) {
      toast.error("Selecciona un número primero");
      return;
    }
    if (!body.trim()) {
      toast.error("Mensaje vacío");
      return;
    }
    const at = "toDate" in when ? when.toDate(tz) : new Date(String(when));
    if (at.getTime() < Date.now() + 30_000) {
      toast.error("Programa al menos 30 segundos en el futuro");
      return;
    }
    onSchedule({
      conversationId,
      phoneNumberId,
      scheduledAt: at,
      type: "TEXT",
      body: body.trim(),
    });
    onClose();
  };

  const pending = scheduled.filter((s) => s.status === "PENDING");

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Programar mensaje
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                El runner intenta enviar cada 30s. Recuerda: la ventana 24h debe estar abierta al
                momento del envío para texto libre.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <DatePicker
                value={when}
                onChange={(v) => v && setWhen(v as CalendarDateTime | ZonedDateTime)}
                granularity="minute"
                minValue={minDt}
                hideTimeZone
                hourCycle={24}
              >
                <Label>Fecha y hora</Label>
                <DateField.Group fullWidth variant="secondary">
                  <DateField.Input>
                    {(segment) => <DateField.Segment segment={segment} />}
                  </DateField.Input>
                  <DateField.Suffix>
                    <DatePicker.Trigger>
                      <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                  </DateField.Suffix>
                </DateField.Group>
                <DatePicker.Popover>
                  <Calendar aria-label="Fecha y hora">
                    <Calendar.Header>
                      <Calendar.YearPickerTrigger>
                        <Calendar.YearPickerTriggerHeading />
                        <Calendar.YearPickerTriggerIndicator />
                      </Calendar.YearPickerTrigger>
                      <Calendar.NavButton slot="previous" />
                      <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                      <Calendar.GridHeader>
                        {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                      </Calendar.GridHeader>
                      <Calendar.GridBody>
                        {(date) => <Calendar.Cell date={date} />}
                      </Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                      <Calendar.YearPickerGridBody>
                        {({ year }) => <Calendar.YearPickerCell year={year} />}
                      </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                  </Calendar>
                </DatePicker.Popover>
              </DatePicker>
              <Description className="text-default-500 text-xs">
                Mínimo 30 segundos en el futuro
              </Description>
              <div>
                <label className="mb-1 block font-medium text-sm">Mensaje</label>
                <TextArea
                  variant="secondary"
                  value={body}
                  onChange={(e) => setBody(e.currentTarget.value)}
                  rows={4}
                  fullWidth
                />
              </div>

              {pending.length > 0 && (
                <div className="space-y-1 rounded-lg border border-default-200 bg-content2 p-3">
                  <p className="font-medium text-default-700 text-xs uppercase">
                    Programados ({pending.length})
                  </p>
                  <ul className="space-y-1">
                    {pending.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-default-500">
                            {dayjs(s.scheduledAt).format("DD-MM HH:mm")}
                          </p>
                          <p className="line-clamp-1 text-default-700">
                            {s.body ?? `[${s.type.toLowerCase()}]`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="danger-soft"
                          isIconOnly
                          aria-label="Cancelar"
                          onPress={() => onCancel(s.id)}
                        >
                          <X size={12} />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cerrar
              </Button>
              <Button onPress={submit} isPending={isPending}>
                <CalendarClock size={14} />
                Programar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function VoiceRecorderButton({
  onSend,
  isDisabled,
}: {
  onSend: (file: File) => void;
  isDisabled: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      tickRef.current && clearInterval(tickRef.current);
    };
  }, [preview]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setPreview({ blob, url });
        setRecording(false);
        if (tickRef.current) {
          clearInterval(tickRef.current);
          tickRef.current = null;
        }
      };
      recorderRef.current = rec;
      rec.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      tickRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
    } catch (err) {
      toast.error(`No se pudo acceder al micrófono: ${String(err)}`);
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const cancel = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const send = () => {
    if (!preview) return;
    const ext = preview.blob.type.includes("mp4") ? "m4a" : "ogg";
    const file = new File([preview.blob], `voice-${Date.now()}.${ext}`, {
      type: preview.blob.type,
    });
    onSend(file);
    URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (preview) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-default-200 bg-content2 px-2 py-1">
        <audio src={preview.url} controls className="h-8" />
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Descartar nota de voz"
          onPress={cancel}
        >
          <X size={14} />
        </Button>
        <Button size="sm" isIconOnly aria-label="Enviar nota de voz" onPress={send}>
          <Send size={14} />
        </Button>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-danger-200 bg-danger-50 px-2 py-1">
        <span className="size-2 animate-pulse rounded-full bg-danger" />
        <span className="font-mono text-danger text-xs tabular-nums">{fmt(elapsed)}</span>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Detener grabación"
          onPress={stop}
          className="ml-1"
        >
          <Check size={14} />
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      isIconOnly
      aria-label="Grabar nota de voz"
      onPress={start}
      isDisabled={isDisabled}
    >
      <Mic size={16} />
    </Button>
  );
}

function MediaGalleryModal({
  isOpen,
  onClose,
  conversationId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
}) {
  const media = useConversationMedia(isOpen ? conversationId : undefined);
  const items = media.data?.media ?? [];

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-2xl rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4 flex items-center justify-between">
              <div>
                <Modal.Heading className="font-bold text-primary text-xl">
                  <Images size={20} className="mr-2 inline" />
                  Galería de medios
                </Modal.Heading>
                <p className="text-default-500 text-xs">
                  {items.length} archivo{items.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button isIconOnly size="sm" variant="outline" onPress={onClose} aria-label="Cerrar">
                <X size={14} />
              </Button>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] overflow-y-auto">
              {media.isLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : items.length === 0 ? (
                <p className="py-12 text-center text-default-500 text-sm">
                  Aún no hay medios en esta conversación.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {items.map((m) => {
                    const url = `/api/wa-cloud/media/${m.messageId}`;
                    if (m.type === "IMAGE" || m.type === "STICKER") {
                      return (
                        <a
                          key={m.messageId}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="aspect-square overflow-hidden rounded-lg border border-default-200 bg-default-100"
                        >
                          <img
                            src={url}
                            alt={m.body ?? m.type}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        </a>
                      );
                    }
                    if (m.type === "VIDEO") {
                      return (
                        <a
                          key={m.messageId}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-default-200 bg-black"
                        >
                          <video
                            src={url}
                            className="size-full object-cover"
                            muted
                            preload="metadata"
                          >
                            <track kind="captions" />
                          </video>
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="rounded-full bg-black/60 p-2 text-white">
                              <FileText size={14} />
                            </span>
                          </span>
                        </a>
                      );
                    }
                    return (
                      <a
                        key={m.messageId}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-default-200 bg-content2 p-2 text-center"
                      >
                        <FileText size={20} className="text-accent" />
                        <span className="line-clamp-2 text-default-700 text-[10px]">
                          {m.body ?? m.type.toLowerCase()}
                        </span>
                      </a>
                    );
                  })}
                </div>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function LocationSelectorModal({
  isOpen,
  onClose,
  conversationId,
  phoneNumberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
}) {
  const list = useSavedLocations();
  const send = useSendSavedLocation();
  const items = list.data?.locations ?? [];

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                <MapPin className="mr-2 inline" size={20} />
                Compartir ubicación
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Selecciona una ubicación pre-guardada. Para crear nuevas, ve a Ajustes WA →
                Catálogo.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[60vh] space-y-2 overflow-y-auto">
              {list.isLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-default-500 text-sm">
                  Sin ubicaciones guardadas. Pídele a un admin que cree una.
                </p>
              ) : (
                items.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => {
                      if (!phoneNumberId) {
                        toast.error("Selecciona un número primero");
                        return;
                      }
                      send.mutate(
                        {
                          conversationId,
                          phoneNumberId,
                          savedLocationId: loc.id,
                        },
                        {
                          onSuccess: () => {
                            toast.success(`Enviada: ${loc.name}`);
                            onClose();
                          },
                          onError: (e) => toast.error(`Error: ${String(e)}`),
                        }
                      );
                    }}
                    className="flex w-full items-start gap-3 rounded-lg border border-default-200 bg-content1 p-3 text-left transition hover:bg-content2"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success-100 text-success-700">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-sm">{loc.name}</p>
                        {loc.isDefault && (
                          <Chip size="sm" color="success" variant="soft">
                            <Chip.Label>default</Chip.Label>
                          </Chip>
                        )}
                      </div>
                      {loc.address && (
                        <p className="line-clamp-2 text-default-500 text-xs">{loc.address}</p>
                      )}
                      <p className="mt-0.5 font-mono text-default-400 text-[10px]">
                        {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </Modal.Body>
            <Modal.Footer className="mt-3 flex justify-end">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function InteractiveListSelectorModal({
  isOpen,
  onClose,
  conversationId,
  phoneNumberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
}) {
  const list = useSavedInteractiveLists();
  const send = useSendSavedList();
  const items = list.data?.lists ?? [];

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                <List className="mr-2 inline" size={20} />
                Lista interactiva
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Selecciona una lista pre-configurada. Solo durante ventana 24h.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[60vh] space-y-2 overflow-y-auto">
              {list.isLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-default-500 text-sm">
                  Sin listas guardadas. Crea una en Ajustes WA → Catálogo.
                </p>
              ) : (
                items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      if (!phoneNumberId) {
                        toast.error("Selecciona un número primero");
                        return;
                      }
                      send.mutate(
                        {
                          conversationId,
                          phoneNumberId,
                          savedListId: it.id,
                        },
                        {
                          onSuccess: () => {
                            toast.success(`Enviada: ${it.name}`);
                            onClose();
                          },
                          onError: (e) => toast.error(`Error: ${String(e)}`),
                        }
                      );
                    }}
                    className="flex w-full items-start gap-3 rounded-lg border border-default-200 bg-content1 p-3 text-left transition hover:bg-content2"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
                      <List size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{it.name}</p>
                      {it.description && (
                        <p className="line-clamp-1 text-default-500 text-xs">{it.description}</p>
                      )}
                      <p className="mt-0.5 text-default-400 text-[10px]">
                        {it.sections.reduce((n, s) => n + s.rows.length, 0)} opciones · usado{" "}
                        {it.hitCount}×
                      </p>
                    </div>
                  </button>
                ))
              )}
            </Modal.Body>
            <Modal.Footer className="mt-3 flex justify-end">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function FlowSelectorModal({
  isOpen,
  onClose,
  conversationId,
  phoneNumberId,
}: {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  phoneNumberId: number | null;
}) {
  const list = useSavedFlows();
  const send = useSendSavedFlow();
  const items = list.data?.flows ?? [];

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
        isDismissable
        className="bg-black/40 backdrop-blur-[2px]"
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                <Layers className="mr-2 inline" size={20} />
                Enviar formulario (Flow)
              </Modal.Heading>
              <p className="text-default-500 text-xs">
                Los Flows se diseñan en Meta Business Manager. Aquí solo eliges cuál enviar.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[60vh] space-y-2 overflow-y-auto">
              {list.isLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : items.length === 0 ? (
                <p className="py-6 text-center text-default-500 text-sm">
                  Sin Flows guardados. Configúralos en Ajustes WA → Catálogo (necesitas el flow_id
                  de Meta).
                </p>
              ) : (
                items.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (!phoneNumberId) {
                        toast.error("Selecciona un número primero");
                        return;
                      }
                      send.mutate(
                        {
                          conversationId,
                          phoneNumberId,
                          savedFlowId: f.id,
                        },
                        {
                          onSuccess: () => {
                            toast.success(`Enviado: ${f.name}`);
                            onClose();
                          },
                          onError: (e) => toast.error(`Error: ${String(e)}`),
                        }
                      );
                    }}
                    className="flex w-full items-start gap-3 rounded-lg border border-default-200 bg-content1 p-3 text-left transition hover:bg-content2"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning-100 text-warning-700">
                      <Layers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-sm">{f.name}</p>
                      {f.description && (
                        <p className="line-clamp-1 text-default-500 text-xs">{f.description}</p>
                      )}
                      <p className="mt-0.5 font-mono text-default-400 text-[10px]">
                        flow_id: {f.flowId} · CTA: {f.defaultCta}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </Modal.Body>
            <Modal.Footer className="mt-3 flex justify-end">
              <Button variant="outline" onPress={onClose}>
                <X size={14} />
                Cerrar
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
