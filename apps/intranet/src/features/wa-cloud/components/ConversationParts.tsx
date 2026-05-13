// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import {
  Button,
  Calendar,
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
import dayjs from "dayjs";
import {
  Ban,
  CalendarClock,
  Check,
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
  ShoppingBag,
  Smile,
  Tag,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { EmojiPickerButton } from "./EmojiPickerButton";
import {
  useConversationMedia,
  useSavedFlows,
  useSavedInteractiveLists,
  useSavedLocations,
  useSendSavedFlow,
  useSendSavedList,
  useSendSavedLocation,
  useSnippets,
} from "../hooks/useWaCloud";

// ── Composer ────────────────────────────────────────────────────────────────

export function TextComposer({
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
  onOpenCommerce,
  onSendSnippet,
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
  onOpenCommerce: () => void;
  onSendSnippet: (snippetId: number) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
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
              <ListBox.Item
                id="commerce"
                onAction={onOpenCommerce}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
              >
                <ShoppingBag size={14} className="text-success" />
                <span>Producto del catálogo</span>
              </ListBox.Item>
            </ListBox>
          </Dropdown.Popover>
        </Dropdown>
        <SnippetsButton
          onPickText={(text) => setBody(text)}
          onSendSnippet={onSendSnippet}
          isDisabled={isDisabled}
        />
        <EmojiPickerButton onSelect={insertEmoji} />
        <VoiceRecorderButton onSend={onAttachFile} isDisabled={isDisabled || attachPending} />
        <div className="relative flex-1">
          <TextArea
            ref={ref}
            variant="secondary"
            value={body}
            onChange={(e) => setBody(e.currentTarget.value)}
            onKeyDown={handleKey}
            placeholder={
              isDisabled
                ? (disabledReason ?? "")
                : "Escribe un mensaje. Enter para enviar, Shift+Enter para nueva línea. Tip: /atajo para snippets."
            }
            disabled={isDisabled}
            rows={1}
            className="w-full resize-none rounded-2xl"
            fullWidth
          />
          <ShortcutAutocomplete
            body={body}
            setBody={setBody}
            onSendSnippet={onSendSnippet}
            isDisabled={isDisabled}
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

// ── Header / settings ───────────────────────────────────────────────────────

export function ConvSettingsMenu({
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

export function LabelStrip({
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
            className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full hover:bg-accent-200/50"
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

// ── Modals ──────────────────────────────────────────────────────────────────

export function ContactsSendModal({
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

export function EditTextModal({
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

export function ScheduleSendModal({
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
      if (tickRef.current) clearInterval(tickRef.current);
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

export function MediaGalleryModal({
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
                  <Spinner aria-label="Cargando" />
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
                        <span className="line-clamp-2 text-default-700 text-xs">
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

export function LocationSelectorModal({
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
                      <p className="mt-0.5 font-mono text-default-400 text-xs">
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

export function InteractiveListSelectorModal({
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
                      <p className="mt-0.5 text-default-400 text-xs">
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

function SnippetsButton({
  onPickText,
  onSendSnippet,
  isDisabled,
}: {
  onPickText: (text: string) => void;
  onSendSnippet: (snippetId: number) => void;
  isDisabled: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useSnippets({ q: q.trim().length >= 1 ? q.trim() : undefined });
  const items = list.data?.snippets ?? [];

  const KIND_ICON: Record<string, React.ReactNode> = {
    TEXT: <FileText size={14} className="text-default-500" />,
    CTA_URL: <Send size={14} className="text-accent" />,
    REPLY_BUTTONS: <List size={14} className="text-warning" />,
    MEDIA_DOCUMENT: <FileText size={14} className="text-accent" />,
    MEDIA_IMAGE: <Images size={14} className="text-success" />,
    MEDIA_VIDEO: <Images size={14} className="text-success" />,
    MEDIA_AUDIO: <Mic size={14} className="text-warning" />,
    MEDIA_STICKER: <Smile size={14} className="text-default-500" />,
  };

  return (
    <Popover>
      <Popover.Trigger>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Snippets / respuestas guardadas"
          isDisabled={isDisabled}
        >
          <Zap size={16} />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-[360px] rounded-2xl border border-default-200 bg-background p-2 shadow-lg">
        <Popover.Dialog className="space-y-2 p-1">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
            placeholder="Buscar snippet…"
            className="w-full rounded-lg border border-default-200 bg-content2 px-3 py-1.5 text-sm outline-none focus:border-success"
            autoFocus
          />
          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {list.isLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size="sm" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-default-400 text-xs">
                Sin snippets. Crea en Catálogo → Snippets.
              </p>
            ) : (
              items.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-default-100"
                >
                  <span className="mt-0.5 shrink-0">{KIND_ICON[s.kind] ?? <Zap size={14} />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-sm">{s.name}</p>
                      {s.shortcut && (
                        <code className="shrink-0 rounded bg-default-200 px-1 text-xs">
                          {s.shortcut}
                        </code>
                      )}
                      {s.category && (
                        <Chip size="sm" variant="soft" color="default">
                          <Chip.Label>{s.category}</Chip.Label>
                        </Chip>
                      )}
                    </div>
                    {s.bodyText && (
                      <p className="line-clamp-1 text-default-500 text-xs">{s.bodyText}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {s.kind === "TEXT" && s.bodyText && (
                      <Button
                        size="sm"
                        variant="outline"
                        isIconOnly
                        aria-label="Insertar"
                        onPress={() => onPickText(s.bodyText!)}
                      >
                        <Pencil size={12} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      isIconOnly
                      aria-label="Enviar ahora"
                      onPress={() => onSendSnippet(s.id)}
                    >
                      <Send size={12} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

export function FlowSelectorModal({
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
                      <p className="mt-0.5 font-mono text-default-400 text-xs">
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

function ShortcutAutocomplete({
  body,
  setBody,
  onSendSnippet,
  isDisabled,
}: {
  body: string;
  setBody: (v: string) => void;
  onSendSnippet: (snippetId: number) => void;
  isDisabled: boolean;
}) {
  const match = body.match(/(?:^|\s)\/([\w-]+)$/);
  const shortcut = match?.[1] ?? "";
  const list = useSnippets(shortcut.length >= 1 ? { q: shortcut } : undefined);
  const filtered = (list.data?.snippets ?? [])
    .filter(
      (s) =>
        (s.shortcut ?? "").toLowerCase().includes(shortcut.toLowerCase()) ||
        s.name.toLowerCase().includes(shortcut.toLowerCase())
    )
    .slice(0, 5);

  if (isDisabled || shortcut.length < 1 || filtered.length === 0) return null;

  const replaceWith = (text: string) => {
    const next = body.replace(/(?:^|\s)\/([\w-]+)$/, (_match, _w, offset: number) =>
      offset === 0 ? text : ` ${text}`
    );
    setBody(next);
  };

  const sendDirect = (id: number) => {
    onSendSnippet(id);
    setBody(body.replace(/(?:^|\s)\/([\w-]+)$/, "").trim());
  };

  return (
    <div className="-translate-y-1 absolute bottom-full left-0 right-0 mb-1 max-h-60 overflow-y-auto rounded-xl border border-default-200 bg-content1 shadow-lg">
      <div className="border-default-200 border-b bg-content2 px-3 py-1 text-default-500 text-xs uppercase">
        Snippets · /{shortcut}
      </div>
      {filtered.map((s) => (
        <div
          key={s.id}
          className="flex items-start gap-2 border-default-100 border-b px-3 py-2 last:border-b-0 hover:bg-default-100"
        >
          <Zap size={12} className="mt-0.5 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium text-sm">{s.name}</p>
              {s.shortcut && (
                <code className="shrink-0 rounded bg-default-200 px-1 text-xs">{s.shortcut}</code>
              )}
              <Chip size="sm" variant="soft" color="default">
                <Chip.Label>{s.kind}</Chip.Label>
              </Chip>
            </div>
            {s.bodyText && <p className="line-clamp-1 text-default-500 text-xs">{s.bodyText}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            {s.kind === "TEXT" && s.bodyText && (
              <Button
                size="sm"
                variant="outline"
                isIconOnly
                aria-label="Insertar texto"
                onPress={() => replaceWith(s.bodyText!)}
              >
                <Pencil size={12} />
              </Button>
            )}
            <Button
              size="sm"
              isIconOnly
              aria-label="Enviar snippet"
              onPress={() => sendDirect(s.id)}
            >
              <Send size={12} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
