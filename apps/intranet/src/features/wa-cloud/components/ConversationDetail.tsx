import {
  Avatar,
  Button,
  Card,
  Chip,
  Dropdown,
  Modal,
  Popover,
  Spinner,
  TextArea,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  CornerUpLeft,
  FileText,
  Layers,
  Paperclip,
  Send,
  Settings2,
  Smile,
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
} from "./SpecialMessage";
import {
  uploadWaMedia,
  useAccounts,
  useConversation,
  useSendFlow,
  useSendMedia,
  useSendReaction,
  useSendTemplate,
  useSendText,
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
  const sendFlow = useSendFlow();
  const [flowOpen, setFlowOpen] = useState(false);
  const updateConv = useUpdateConversation();
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
      <Card.Header className="flex items-center justify-between gap-3 border-default-200 border-b p-3">
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
            phoneId={phoneId}
            phoneOptions={phoneOptions}
            onPhoneChange={setPhoneId}
            onRelease={() => updateConv.mutate({ id: conversationId, assignedToUserId: null })}
          />
        </div>
      </Card.Header>

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
                />
              )
            )
          )}
        </div>

        <div className="border-default-200 border-t bg-background p-3">
          {mode === "text" ? (
            <TextComposer
              body={body}
              setBody={setBody}
              onSend={handleSendText}
              isDisabled={!c.windowOpen || !phoneId}
              disabledReason={
                !c.windowOpen
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
      <FlowSendModal
        isOpen={flowOpen}
        onClose={() => setFlowOpen(false)}
        conversationId={conversationId}
        phoneNumberId={phoneId ? Number(phoneId) : null}
        onSend={(input) => sendFlow.mutate(input)}
        isPending={sendFlow.isPending}
      />
    </>
  );
}

function ChatBubble({
  row,
  onReply,
  onReact,
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
}) {
  const out = row.out;
  const isPending = row.status === "PENDING";
  const failed = row.status === "FAILED";
  const wrapper = out ? "justify-end" : "justify-start";
  const canInteract = row.metaMessageId !== null;
  // 100% HeroUI semantic tokens. Outbound uses success (clinic green),
  // inbound uses content1 (raised surface), failed uses danger.
  const bubbleColor = out
    ? failed
      ? "bg-danger text-danger-foreground"
      : "bg-success text-success-foreground"
    : "bg-content1 text-foreground border border-default-200";
  const radius = out ? "rounded-l-2xl rounded-tr-2xl" : "rounded-r-2xl rounded-tl-2xl";
  const isMedia = ["IMAGE", "STICKER", "VIDEO", "AUDIO", "DOCUMENT"].includes(row.type);
  const fallbackLabel = row.templateName
    ? `[plantilla] ${row.templateName}`
    : `[${row.type.toLowerCase()}]`;

  const actions = canInteract ? (
    <div
      className={`absolute top-1 ${out ? "right-full mr-1" : "left-full ml-1"} hidden gap-1 group-hover:flex`}
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
    </div>
  ) : null;

  return (
    <div className={`group relative flex ${wrapper}`}>
      <div className="relative">
        {actions}
        <div
          className={`max-w-[78%] ${radius} ${row.type === "STICKER" ? "" : "px-3 py-2 shadow-sm"} ${bubbleColor} ${
            isPending ? "opacity-70" : ""
          }`}
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
          ) : isMedia && row.messageId ? (
            <MediaAttachment messageId={row.messageId} type={row.type} caption={row.body} />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-snug">
              {row.body ?? fallbackLabel}
            </p>
          )}
          <div
            className={`flex items-center justify-end gap-1 text-[10px] ${out ? "text-success-foreground/80" : "text-default-500"} ${row.type === "STICKER" ? "px-2 pb-1" : "mt-1"}`}
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
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Adjuntar archivo"
          onPress={() => fileRef.current?.click()}
          isDisabled={isDisabled || attachPending}
        >
          <Paperclip size={16} />
        </Button>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Enviar formulario"
          onPress={onOpenFlow}
          isDisabled={isDisabled}
        >
          <Layers size={16} />
        </Button>
        <EmojiPickerButton onSelect={insertEmoji} />
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
  phoneId,
  phoneOptions,
  onPhoneChange,
  onRelease,
}: {
  phoneId: string;
  phoneOptions: { value: string; label: string }[];
  onPhoneChange: (v: string) => void;
  onRelease: () => void;
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
          <Button size="sm" variant="outline" fullWidth onPress={onRelease}>
            Liberar asignación
          </Button>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function FlowSendModal({
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
    flowId: string;
    flowCta: string;
    bodyText: string;
    headerText?: string;
    footerText?: string;
  }) => void;
  isPending: boolean;
}) {
  const [flowId, setFlowId] = useState("");
  const [flowCta, setFlowCta] = useState("Iniciar");
  const [bodyText, setBodyText] = useState("");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setFlowId("");
      setFlowCta("Iniciar");
      setBodyText("");
      setHeaderText("");
      setFooterText("");
    }
  }, [isOpen]);

  const submit = () => {
    if (!phoneNumberId) {
      toast.error("Selecciona un número primero");
      return;
    }
    if (!flowId.trim() || !bodyText.trim() || !flowCta.trim()) {
      toast.error("Flow ID, CTA y mensaje son obligatorios");
      return;
    }
    onSend({
      conversationId,
      phoneNumberId,
      flowId: flowId.trim(),
      flowCta: flowCta.trim(),
      bodyText: bodyText.trim(),
      headerText: headerText.trim() || undefined,
      footerText: footerText.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal>
      <Modal.Backdrop
        className="bg-black/40 backdrop-blur-[2px]"
        isOpen={isOpen}
        onOpenChange={(o) => !o && onClose()}
      >
        <Modal.Container placement="center">
          <Modal.Dialog className="relative w-full max-w-md rounded-[28px] bg-background p-6 shadow-2xl">
            <Modal.Header className="mb-4">
              <Modal.Heading className="font-bold text-primary text-xl">
                Enviar formulario (Flow)
              </Modal.Heading>
              <p className="text-default-500 text-sm">
                Mensaje interactivo con CTA que abre un Flow de Meta.
              </p>
            </Modal.Header>
            <Modal.Body className="max-h-[70vh] space-y-3 overflow-y-auto">
              <TextInput
                label="Flow ID"
                value={flowId}
                onValueChange={setFlowId}
                placeholder="123456789012345"
              />
              <TextInput
                label="Texto del botón (CTA)"
                value={flowCta}
                onValueChange={setFlowCta}
                placeholder="Iniciar"
              />
              <TextInput
                label="Mensaje (body)"
                value={bodyText}
                onValueChange={setBodyText}
                placeholder="Completa este formulario para agendar tu cita"
              />
              <TextInput
                label="Encabezado (opcional)"
                value={headerText}
                onValueChange={setHeaderText}
                placeholder="Anamnesis previa"
              />
              <TextInput
                label="Pie (opcional)"
                value={footerText}
                onValueChange={setFooterText}
                placeholder="Solo toma 2 minutos"
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
