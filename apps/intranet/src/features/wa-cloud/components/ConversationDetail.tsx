import { Avatar, Button, Card, Chip, Dropdown, Spinner } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { AlertCircle, Check, CheckCheck, Clock, FileText, Send, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import {
  useAccounts,
  useConversation,
  useSendTemplate,
  useSendText,
  useTemplates,
  useUpdateConversation,
} from "../hooks/useWaCloud";

type MessageStatus = "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING";

function StatusTicks({ status }: { status: MessageStatus }) {
  const cls = "inline-block";
  if (status === "PENDING") return <Clock className={cls} size={14} aria-label="enviando" />;
  if (status === "FAILED")
    return <AlertCircle className={`${cls} text-danger`} size={14} aria-label="falló" />;
  if (status === "READ")
    return <CheckCheck className={`${cls} text-sky-500`} size={14} aria-label="leído" />;
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
  const updateConv = useUpdateConversation();

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
    setBody("");
    setPending((p) => [...p, { cid, body: text, timestamp: new Date(), status: "PENDING" }]);
    sendText.mutate(
      { conversationId, phoneNumberId: pn, body: text },
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
  type Row =
    | { kind: "divider"; key: string; label: string }
    | {
        kind: "message";
        key: string;
        out: boolean;
        body: string | null;
        type: string;
        timestamp: Date;
        status: MessageStatus;
        errorTitle?: string | null;
        errorDetails?: string | null;
        templateName?: string | null;
      };

  const allMessages: Row[] = [];
  let lastDay = "";
  const serverMsgs = c.messages.map((m) => ({ ...m, _src: "server" as const }));
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
    allMessages.push({
      kind: "message",
      key: `${m._src}-${m.id}`,
      out: m.direction === "OUTBOUND",
      body: m.body,
      type: m.type,
      timestamp: new Date(m.timestamp),
      status: m.status as MessageStatus,
      errorTitle: m.errorTitle,
      errorDetails: m.errorDetails,
      templateName: m.templateName,
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
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-default-50 px-4 py-3">
          {allMessages.length === 0 ? (
            <p className="py-8 text-center text-default-400 text-sm">
              Sin mensajes aún en esta conversación.
            </p>
          ) : (
            allMessages.map((row) =>
              row.kind === "divider" ? (
                <div key={row.key} className="flex justify-center py-2">
                  <span className="rounded-full bg-default-200 px-3 py-0.5 text-default-600 text-xs">
                    {row.label}
                  </span>
                </div>
              ) : (
                <ChatBubble key={row.key} row={row} />
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
    </>
  );
}

function ChatBubble({
  row,
}: {
  row: {
    out: boolean;
    body: string | null;
    type: string;
    timestamp: Date;
    status: MessageStatus;
    errorTitle?: string | null;
    errorDetails?: string | null;
    templateName?: string | null;
  };
}) {
  const out = row.out;
  const isPending = row.status === "PENDING";
  const failed = row.status === "FAILED";
  const wrapper = out ? "justify-end" : "justify-start";
  const bubbleColor = out
    ? failed
      ? "bg-danger-50 text-danger-900"
      : "bg-success-100 text-foreground"
    : "bg-background text-foreground";
  const radius = out ? "rounded-l-2xl rounded-tr-2xl" : "rounded-r-2xl rounded-tl-2xl";
  const label =
    row.body ??
    (row.templateName ? `[plantilla] ${row.templateName}` : `[${row.type.toLowerCase()}]`);

  return (
    <div className={`flex ${wrapper}`}>
      <div
        className={`max-w-[78%] ${radius} px-3 py-2 shadow-sm ${bubbleColor} ${
          isPending ? "opacity-70" : ""
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-sm leading-snug">{label}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-default-500 text-[10px]">
          <span>{dayjs(row.timestamp).format("HH:mm")}</span>
          {out && <StatusTicks status={row.status} />}
        </div>
        {failed && row.errorTitle && (
          <p className="mt-1 text-[11px] text-danger">
            {row.errorTitle}
            {row.errorDetails ? `: ${row.errorDetails}` : ""}
          </p>
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
}: {
  body: string;
  setBody: (v: string) => void;
  onSend: () => void;
  isDisabled: boolean;
  disabledReason: string | null;
  onSwitchTemplate: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
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

  return (
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
      <div className="flex-1">
        <textarea
          ref={ref}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            isDisabled
              ? (disabledReason ?? "")
              : "Escribe un mensaje. Enter para enviar, Shift+Enter para nueva línea."
          }
          disabled={isDisabled}
          rows={1}
          className="w-full resize-none rounded-2xl border border-default-200 bg-default-100 px-4 py-2 text-sm placeholder:text-default-400 focus:border-success focus:bg-default-50 focus:outline-none disabled:opacity-60"
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
