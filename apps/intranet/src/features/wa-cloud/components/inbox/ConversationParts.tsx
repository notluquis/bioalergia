// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null): refactor each `!` to invariant() or explicit guard. Tracked in repo-wide non-null cleanup.
import { formatChile } from "@/lib/dates";
import {
  Button,
  Calendar,
  Chip,
  DateField,
  DatePicker,
  Description,
  Drawer,
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
  Pause,
  Pencil,
  Play,
  Plus,
  Send,
  Settings2,
  ShoppingBag,
  Smile,
  Square,
  Tag,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppModal } from "@/components/ui/AppModal";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { toast } from "@/lib/toast-interceptor";
import { EmojiPickerButton } from "./EmojiPickerButton";
import { StickerPickerButton } from "./StickerPickerButton";
import { useIsTouch } from "../../lib/usePointer";
import {
  useConversationMedia,
  useSavedFlows,
  useSavedInteractiveLists,
  useSavedLocations,
  useSendSavedFlow,
  useSendSavedList,
  useSendSavedLocation,
  useSnippets,
} from "../../hooks/useWaCloud";

// ── Composer ────────────────────────────────────────────────────────────────

type AttachItem = { id: string; icon: React.ReactNode; label: string; run: () => void };

// Attach (+) menu: a compact dropdown on desktop, a finger-friendly bottom-sheet
// with ≥44px rows on touch (the primary device for TENS/nurses).
function AttachMenu({
  items,
  isDisabled,
  isTouch,
}: {
  items: AttachItem[];
  isDisabled: boolean;
  isTouch: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (isTouch) {
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Adjuntar"
          isDisabled={isDisabled}
          onPress={() => setOpen(true)}
        >
          <Plus size={16} />
        </Button>
        <Drawer>
          <Drawer.Backdrop isOpen={open} onOpenChange={setOpen} variant="blur">
            <Drawer.Content placement="bottom" className="p-0">
              <Drawer.Dialog
                aria-label="Adjuntar"
                className="flex flex-col gap-1 rounded-t-3xl border border-default-200 border-b-0 bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl"
              >
                <Drawer.Handle />
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      it.run();
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-default-100"
                  >
                    <span className="shrink-0">{it.icon}</span>
                    {it.label}
                  </button>
                ))}
              </Drawer.Dialog>
            </Drawer.Content>
          </Drawer.Backdrop>
        </Drawer>
      </>
    );
  }
  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <Dropdown.Trigger>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Adjuntar"
          isDisabled={isDisabled}
        >
          <Plus size={16} />
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-56 p-1">
        <ListBox aria-label="Adjuntar opciones" className="space-y-0.5">
          {items.map((it) => (
            <ListBox.Item
              key={it.id}
              id={it.id}
              onAction={() => {
                // Close the menu before the action opens a modal/picker — else
                // the popover lingers behind the modal (HeroUI doesn't auto-close
                // when focus jumps into a freshly-mounted overlay).
                setOpen(false);
                it.run();
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm data-[hovered]:bg-default-100"
            >
              {it.icon}
              <span>{it.label}</span>
            </ListBox.Item>
          ))}
        </ListBox>
      </Dropdown.Popover>
    </Dropdown>
  );
}

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
  inputRef,
  onFocusComposer,
  stickerAccountId,
  onSendSticker,
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
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
  onFocusComposer?: () => void;
  stickerAccountId?: number;
  onSendSticker?: (savedStickerId: number) => void;
}) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? internalRef;
  const fileRef = useRef<HTMLInputElement>(null);
  const isTouch = useIsTouch();
  // While the voice recorder is recording/previewing it owns the composer row;
  // hide the textarea + send button so there's a single, unambiguous send.
  const [voiceActive, setVoiceActive] = useState(false);
  const attachItems: AttachItem[] = [
    {
      id: "file",
      icon: <Paperclip size={16} className="text-default-500" />,
      label: "Archivo / foto / video",
      run: () => fileRef.current?.click(),
    },
    {
      id: "location",
      icon: <MapPin size={16} className="text-success" />,
      label: "Ubicación",
      run: onOpenLocation,
    },
    {
      id: "contact",
      icon: <ContactIcon size={16} className="text-accent" />,
      label: "Contacto",
      run: onOpenContacts,
    },
    {
      id: "flow",
      icon: <Layers size={16} className="text-default-500" />,
      label: "Formulario (Flow)",
      run: onOpenFlow,
    },
    {
      id: "list",
      icon: <List size={16} className="text-accent" />,
      label: "Lista interactiva",
      run: onOpenList,
    },
    {
      id: "schedule",
      icon: <CalendarClock size={16} className="text-warning" />,
      label: "Programar mensaje",
      run: onOpenSchedule,
    },
    {
      id: "commerce",
      icon: <ShoppingBag size={16} className="text-success" />,
      label: "Producto del catálogo",
      run: onOpenCommerce,
    },
  ];
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
        aria-label="Adjuntar archivo"
        className="hidden"
        accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,audio/*,video/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAttachFile(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
      <div className="flex flex-wrap items-end gap-2">
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Cambiar a plantilla"
          onPress={onSwitchTemplate}
        >
          <FileText size={16} />
        </Button>
        <AttachMenu
          items={attachItems}
          isDisabled={isDisabled || attachPending}
          isTouch={isTouch}
        />
        <SnippetsButton
          onPickText={(text) => setBody(text)}
          onSendSnippet={onSendSnippet}
          isDisabled={isDisabled}
        />
        <EmojiPickerButton onSelect={insertEmoji} />
        {onSendSticker && (
          <StickerPickerButton
            accountId={stickerAccountId}
            isDisabled={isDisabled || !stickerAccountId}
            onSend={onSendSticker}
          />
        )}
        <VoiceRecorderButton
          onSend={onAttachFile}
          isDisabled={isDisabled || attachPending}
          onActiveChange={setVoiceActive}
        />
        {!voiceActive && (
          <>
            <div className="relative order-first w-full min-w-0 md:order-none md:w-auto md:flex-1">
              <TextArea
                ref={ref}
                variant="secondary"
                value={body}
                onChange={(e) => setBody(e.currentTarget.value)}
                onKeyDown={handleKey}
                onFocus={onFocusComposer}
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
          </>
        )}
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
        <Button size="sm" variant="ghost" isIconOnly aria-label="Ajustes conversación">
          <Settings2 size={15} />
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
    <div className="flex flex-wrap items-center gap-1.5 border-default-200 border-b bg-content1 px-3 py-1.5">
      <Tag size={12} className="text-default-400" />
      {labels.length === 0 && <span className="text-default-400 text-xs">Sin etiquetas</span>}
      {labels.map((l) => (
        <Chip key={l} size="sm" color="default" variant="soft">
          <Chip.Label>{l}</Chip.Label>
          <button
            type="button"
            onClick={() => remove(l)}
            className="ml-1 inline-flex min-h-6 min-w-6 items-center justify-center rounded-full hover:bg-default-200/60"
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
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Programar mensaje"
      size="md"
      footer={
        <>
          <Button variant="outline" onPress={onClose}>
            <X size={14} />
            Cerrar
          </Button>
          <Button onPress={submit} isPending={isPending}>
            <CalendarClock size={14} />
            Programar
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-default-500 text-xs">
          El runner intenta enviar cada 30s. Recuerda: la ventana 24h debe estar abierta al momento
          del envío para texto libre.
        </p>
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
                <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
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
          <label htmlFor="wa-schedule-body" className="mb-1 block font-medium text-sm">
            Mensaje
          </label>
          <TextArea
            id="wa-schedule-body"
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
                      {formatChile(s.scheduledAt, "DD-MM HH:mm")}
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
      </div>
    </AppModal>
  );
}

// Normalize a recorded audio blob to a WhatsApp-accepted container. WA takes
// ogg/opus, mp4/aac, mpeg, amr — but NOT webm (Chrome's MediaRecorder default).
// When the blob is webm, remux it to ogg/opus with mediabunny (codec
// passthrough — copies the Opus stream, no re-encode). ogg/mp4 pass through.
async function toWaAudio(blob: Blob): Promise<{ blob: Blob; ext: string }> {
  const base = (blob.type.split(";")[0] || "").trim();
  if (base === "audio/ogg") return { blob, ext: "ogg" };
  if (base === "audio/mp4" || base === "audio/aac") return { blob, ext: "m4a" };
  const { Input, Output, Conversion, BlobSource, BufferTarget, OggOutputFormat, WEBM } =
    await import("mediabunny");
  const input = new Input({ source: new BlobSource(blob), formats: [WEBM] });
  const output = new Output({ format: new OggOutputFormat(), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output });
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("audio remux produced no output");
  return { blob: new Blob([buffer], { type: "audio/ogg" }), ext: "ogg" };
}

function VoiceRecorderButton({
  onSend,
  isDisabled,
  onActiveChange,
}: {
  onSend: (file: File) => void;
  isDisabled: boolean;
  // Notifies the composer when the recorder takes over (recording or previewing)
  // so it can hide its textarea + send button — avoids a confusing double-send.
  onActiveChange?: (active: boolean) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  // True while the remux+handoff runs, so a second tap can't send a duplicate.
  const [sending, setSending] = useState(false);
  // OpusMediaRecorder has the same surface we use as MediaRecorder.
  const recorderRef = useRef<{ state: string; stop(): void } | null>(null);
  const previewRef = useRef<HTMLAudioElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [preview]);

  useEffect(() => {
    onActiveChange?.(recording || preview !== null);
  }, [recording, preview, onActiveChange]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Record with the native MediaRecorder in whatever Opus/AAC container the
      // browser supports (Chrome: webm/opus, Firefox: ogg/opus, Safari: mp4/aac).
      // The WA-incompatible webm case is remuxed to ogg at send time (see send()).
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
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
    setPreviewPlaying(false);
  };

  const togglePreview = () => {
    const a = previewRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const send = async () => {
    if (!preview || sending) return;
    setSending(true);
    try {
      const { blob, ext } = await toWaAudio(preview.blob);
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });
      onSend(file);
    } catch {
      toast.error("No se pudo procesar la nota de voz");
      setSending(false);
      return;
    }
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    setPreviewPlaying(false);
    setSending(false);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  if (preview) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-default-200 bg-content2 px-2 py-1">
        {/* Custom controls (no native <audio controls>): Safari's media-control
            glyphs (airplay/pip placards) fail to load on blob/ogg sources and
            spam the console. A play/pause button avoids them entirely. */}
        <audio
          ref={previewRef}
          src={preview.url}
          aria-label="Previsualización de nota de voz"
          className="hidden"
          onEnded={() => setPreviewPlaying(false)}
          onPlay={() => setPreviewPlaying(true)}
          onPause={() => setPreviewPlaying(false)}
        >
          <track kind="captions" />
        </audio>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label={previewPlaying ? "Pausar" : "Reproducir"}
          onPress={togglePreview}
        >
          {previewPlaying ? <Pause size={14} /> : <Play size={14} />}
        </Button>
        <span className="px-1 font-mono text-default-600 text-xs tabular-nums">{fmt(elapsed)}</span>
        <Button
          size="sm"
          variant="outline"
          isIconOnly
          aria-label="Descartar nota de voz"
          onPress={cancel}
          isDisabled={sending}
        >
          <Trash2 size={14} />
        </Button>
        <Button
          size="sm"
          isIconOnly
          aria-label="Enviar nota de voz"
          onPress={() => void send()}
          isPending={sending}
          isDisabled={sending}
        >
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
          <Square size={13} className="fill-current" />
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
      onPress={() => {
        void start();
      }}
      isDisabled={isDisabled}
    >
      <Mic size={16} />
    </Button>
  );
}

// One media-gallery cell. Images/videos try to render a thumbnail; on error
// (expired Meta media) or for docs/audio they fall back to a neutral icon tile
// with a Spanish label — never a broken "?" image.
const GALLERY_LABEL: Record<string, string> = {
  IMAGE: "Imagen",
  VIDEO: "Vídeo",
  AUDIO: "Nota de voz",
  DOCUMENT: "Documento",
};
function GalleryTile({
  type,
  body,
  messageId,
}: {
  type: string;
  body: string | null;
  messageId: number;
}) {
  const url = `/api/wa-cloud/media/${messageId}`;
  const [errored, setErrored] = useState(false);
  const fallbackIcon = type === "VIDEO" ? Images : type === "AUDIO" ? Mic : FileText;
  const FallbackIcon = type === "IMAGE" ? Images : fallbackIcon;

  if ((type === "IMAGE" || type === "VIDEO") && !errored) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={GALLERY_LABEL[type] ?? "Archivo"}
        className="relative aspect-square overflow-hidden rounded-lg border border-default-200 bg-content1"
      >
        {type === "IMAGE" ? (
          <img
            src={url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={() => setErrored(true)}
          />
        ) : (
          <video
            src={url}
            aria-label="Vista previa de video"
            className="size-full object-cover"
            muted
            preload="metadata"
            onError={() => setErrored(true)}
          >
            <track kind="captions" />
          </video>
        )}
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-default-200 bg-content1 p-2 text-center transition hover:bg-content2"
    >
      <FallbackIcon size={22} className="text-default-400" />
      <span className="line-clamp-2 text-default-500 text-xs">
        {body?.trim() || GALLERY_LABEL[type] || "Archivo"}
      </span>
    </a>
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
  // Stickers live in their own picker — they're chrome, not shareable media.
  const items = (media.data?.media ?? []).filter((m) => m.type !== "STICKER");

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
                  {items.map((m) => (
                    <GalleryTile
                      key={m.messageId}
                      type={m.type}
                      body={m.body}
                      messageId={m.messageId}
                    />
                  ))}
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
            aria-label="Buscar snippet"
            className="w-full rounded-lg border border-default-200 bg-content2 px-3 py-1.5 text-sm outline-none focus:border-success"
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
