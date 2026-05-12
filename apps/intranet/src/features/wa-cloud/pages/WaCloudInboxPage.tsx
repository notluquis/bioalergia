import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Dropdown,
  EmptyState,
  Input,
  Kbd,
  Label,
  ListBox,
  Modal,
  ScrollShadow,
  SearchField,
  Select,
  Skeleton,
  Tag,
  TagGroup,
} from "@heroui/react";
// Spinner removed in favour of ConversationListSkeleton for the inbox list.
import dayjs from "dayjs";
import { ArrowLeft, Filter, Inbox, MessageSquareText, Phone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WaConversationStatus } from "@finanzas/orpc-contracts/wa-cloud";
import { ConversationDetail } from "../components/ConversationDetail";
import { useFaviconBadge } from "../hooks/useFaviconBadge";
import { useAccounts, useConversations, useMarkRead, useSearchMessages } from "../hooks/useWaCloud";

// iOS-style stack navigation: on viewports <lg, list and detail are
// mutually exclusive screens (selecting a conversation pushes the
// detail "view" on top). On >=lg the classic split view stays.
const MOBILE_BREAKPOINT_QUERY = "(max-width: 1023px)";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

const STATUS_OPTIONS: { value: "" | WaConversationStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "ARCHIVED", label: "Archivados" },
];

// Stable color per phone number, hashed into a small palette. Uses
// alpha-tinted backgrounds + the matching semantic foreground so the
// initials stay legible across light/dark themes (the previous
// `bg-success-200 text-success-900` pair was illegible in dark mode).
const AVATAR_COLORS = [
  "bg-success/15 text-success",
  "bg-warning/15 text-warning",
  "bg-accent/15 text-accent",
  "bg-danger/15 text-danger",
  "bg-default/40 text-default-foreground",
];
function colorFor(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}
function formatRelative(d: Date | null | undefined): string {
  if (!d) return "";
  const now = dayjs();
  const m = dayjs(d);
  if (m.isSame(now, "day")) return m.format("HH:mm");
  if (m.isSame(now.subtract(1, "day"), "day")) return "Ayer";
  if (m.isAfter(now.subtract(7, "day"))) return m.format("ddd");
  return m.format("DD-MM-YY");
}

export function WaCloudInboxPage() {
  const accounts = useAccounts();
  const allPhones = useMemo(
    () => (accounts.data?.accounts ?? []).flatMap((a) => a.phoneNumbers),
    [accounts.data]
  );

  const [status, setStatus] = useState<WaConversationStatus | "">("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const isMobile = useIsMobile();
  // On mobile we render either the list or the detail view, not both.
  const showDetail = isMobile ? selectedId !== null : true;
  const showList = isMobile ? selectedId === null : true;

  const conversations = useConversations({
    status: status || undefined,
    phoneNumberId: phoneFilter ? Number.parseInt(phoneFilter, 10) : undefined,
    search: search.trim() || undefined,
    page: 1,
    pageSize: 50,
  });
  const markRead = useMarkRead();
  const messageHits = useSearchMessages(
    search.trim().length >= 2 ? { q: search.trim(), limit: 20 } : null
  );

  useEffect(() => {
    if (selectedId) markRead.mutate(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const items = conversations.data?.items ?? [];
  const activeFiltersCount = (status ? 1 : 0) + (phoneFilter ? 1 : 0);
  const totalUnread = useMemo(
    () => items.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [items]
  );

  // Tab title shows the unread total so the operator notices new
  // WhatsApp activity even from another tab. Favicon also gets a
  // red badge so the visual signal works without reading the title.
  useEffect(() => {
    const base = "Inbox WhatsApp · Bioalergia";
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;
    return () => {
      document.title = "Bioalergia";
    };
  }, [totalUnread]);
  useFaviconBadge(totalUnread);

  // Keyboard shortcuts: j/k navigate list, Enter open, Esc close,
  // / focus search, ? show help. Inputs/textareas are excluded so
  // typing in the composer doesn't hijack keys.
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inEditable =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if (inEditable && e.key !== "Escape") return;
      if (e.key === "Escape") {
        if (showHelp) {
          setShowHelp(false);
        } else if (selectedId !== null) {
          setSelectedId(null);
        }
        e.preventDefault();
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        setShowHelp((v) => !v);
        e.preventDefault();
        return;
      }
      if (e.key === "/") {
        const input = document.querySelector<HTMLInputElement>(
          "input[aria-label='Buscar conversación']"
        );
        if (input) {
          input.focus();
          e.preventDefault();
        }
        return;
      }
      if (items.length === 0) return;
      const idx = selectedId ? items.findIndex((c) => c.id === selectedId) : -1;
      if (e.key === "j" || e.key === "ArrowDown") {
        const next = items[Math.min(items.length - 1, idx + 1)];
        if (next) setSelectedId(next.id);
        e.preventDefault();
      } else if (e.key === "k" || e.key === "ArrowUp") {
        const prev = items[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev.id);
        e.preventDefault();
      }
    },
    [items, selectedId, showHelp]
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  return (
    <div className="h-[calc(100dvh-7rem)] p-4">
      <Card className="grid h-full grid-cols-1 overflow-hidden p-0 lg:grid-cols-[360px_1fr]">
        {showList && (
          <aside className="flex h-full flex-col border-default-200 lg:border-r">
            <header className="flex flex-col gap-2 border-default-200 border-b p-3">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-semibold text-base">
                  <Inbox size={18} className="text-success" />
                  Bandeja
                </h2>
                <FilterDropdown
                  status={status}
                  onStatusChange={setStatus}
                  phoneFilter={phoneFilter}
                  onPhoneChange={setPhoneFilter}
                  phones={allPhones}
                  activeCount={activeFiltersCount}
                />
              </div>

              <SearchField
                variant="secondary"
                value={search}
                onChange={setSearch}
                aria-label="Buscar conversación"
              >
                <SearchField.Group>
                  <SearchField.SearchIcon />
                  <SearchField.Input placeholder="Buscar por nombre o teléfono" />
                  <SearchField.ClearButton />
                </SearchField.Group>
              </SearchField>
            </header>

            <ActiveFilterChips
              status={status}
              onStatusClear={() => setStatus("")}
              phoneFilter={phoneFilter}
              onPhoneClear={() => setPhoneFilter("")}
              phones={allPhones}
            />

            <ScrollShadow
              orientation="vertical"
              size={32}
              hideScrollBar
              className="flex-1 overflow-y-auto"
            >
              {conversations.isLoading || !conversations.data ? (
                <ConversationListSkeleton />
              ) : items.length === 0 ? (
                <EmptyState className="m-4 p-6 text-center">
                  <MessageSquareText size={28} className="mx-auto text-default-400" />
                  <p className="mt-2 font-medium text-sm">Sin conversaciones</p>
                  <p className="text-default-500 text-xs">
                    {search || activeFiltersCount > 0
                      ? "Cambia los filtros para ver más."
                      : "Cuando lleguen mensajes, aparecerán aquí."}
                  </p>
                </EmptyState>
              ) : (
                <ListBox
                  aria-label="Conversaciones"
                  selectionMode="single"
                  selectedKeys={selectedId ? new Set([String(selectedId)]) : new Set()}
                  onSelectionChange={(keys) => {
                    const k = [...(keys as Set<string>)][0];
                    if (k) setSelectedId(Number(k));
                  }}
                  className="border-0 bg-transparent p-0"
                >
                  {items.map((c) => {
                    const name = c.contact.name ?? c.contact.pushName ?? c.contact.phoneE164;
                    const initials = initialsOf(name);
                    const avatarColor = colorFor(c.contact.phoneE164);
                    return (
                      <ListBox.Item
                        key={c.id}
                        id={String(c.id)}
                        textValue={name}
                        className="rounded-none border-default-200 border-b px-3 py-3 transition-[background-color] duration-150 ease-out"
                      >
                        <div className="flex w-full items-center gap-3">
                          {c.unreadCount > 0 ? (
                            <Badge color="success" placement="top-right" size="sm">
                              <Badge.Label>{c.unreadCount}</Badge.Label>
                              <Badge.Anchor>
                                <Avatar className={`size-11 shrink-0 ${avatarColor}`}>
                                  <Avatar.Fallback delayMs={0} className="font-semibold text-sm">
                                    {initials}
                                  </Avatar.Fallback>
                                </Avatar>
                              </Badge.Anchor>
                            </Badge>
                          ) : (
                            <Avatar className={`size-11 shrink-0 ${avatarColor}`}>
                              <Avatar.Fallback delayMs={0} className="font-semibold text-sm">
                                {initials}
                              </Avatar.Fallback>
                            </Avatar>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={`truncate text-sm ${c.unreadCount > 0 ? "font-semibold" : "font-medium"}`}
                              >
                                {name}
                              </span>
                              <span
                                className={`shrink-0 text-xs ${c.unreadCount > 0 ? "font-semibold text-success" : "text-default-500"}`}
                              >
                                {formatRelative(c.lastMessageAt)}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <p
                                className={`line-clamp-1 text-xs ${c.unreadCount > 0 ? "font-medium text-default-700" : "text-default-500"}`}
                              >
                                {c.lastMessagePreview ?? "Sin actividad"}
                              </p>
                              <ConversationStatusChip status={c.status} />
                            </div>
                          </div>
                        </div>
                      </ListBox.Item>
                    );
                  })}
                </ListBox>
              )}
              {messageHits.data && messageHits.data.results.length > 0 && (
                <div className="border-default-200 border-t bg-content2 p-2">
                  <p className="px-2 pb-1 font-semibold text-default-500 text-xs uppercase">
                    Mensajes ({messageHits.data.results.length})
                  </p>
                  <ul className="space-y-1">
                    {messageHits.data.results.map((m) => (
                      <li key={m.messageId}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(m.conversationId)}
                          className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition hover:bg-default-100"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-xs">
                              {m.contactName ?? m.phoneE164}
                            </span>
                            <span className="shrink-0 text-default-400 text-xs">
                              {dayjs(m.timestamp).format("DD-MM HH:mm")}
                            </span>
                          </div>
                          <p className="line-clamp-2 text-default-600 text-xs">
                            {m.body ?? `[${m.type.toLowerCase()}]`}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </ScrollShadow>
          </aside>
        )}

        {showDetail && (
          <section className="flex h-full flex-col overflow-hidden bg-content1">
            {isMobile && selectedId && (
              <div className="flex items-center gap-2 border-default-200 border-b bg-content2 px-2 py-1.5">
                <Button
                  variant="tertiary"
                  size="sm"
                  onPress={() => setSelectedId(null)}
                  aria-label="Volver a la bandeja"
                >
                  <ArrowLeft size={16} />
                  Bandeja
                </Button>
              </div>
            )}
            {selectedId ? (
              <ConversationDetail conversationId={selectedId} />
            ) : (
              <div className="flex h-full flex-1 items-center justify-center bg-default-50 p-8">
                <EmptyState className="max-w-sm text-center">
                  <MessageSquareText size={48} className="mx-auto text-default-300" />
                  <p className="mt-3 font-semibold text-base">Selecciona una conversación</p>
                  <p className="mt-1 text-default-500 text-sm">
                    Tus mensajes WhatsApp aparecen en la bandeja de la izquierda. Click en
                    cualquiera para responder. Atajos: <kbd>j</kbd>/<kbd>k</kbd> navegar,{" "}
                    <kbd>/</kbd> buscar, <kbd>Esc</kbd> cerrar.
                  </p>
                </EmptyState>
              </div>
            )}
          </section>
        )}
      </Card>
      <KeyboardHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-0 divide-default-200 divide-y">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-2.5 w-10 rounded" />
            </div>
            <Skeleton className="h-2.5 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActiveFilterChips({
  status,
  onStatusClear,
  phoneFilter,
  onPhoneClear,
  phones,
}: {
  status: WaConversationStatus | "";
  onStatusClear: () => void;
  phoneFilter: string;
  onPhoneClear: () => void;
  phones: { id: number; label: string | null; displayPhoneNumber: string }[];
}) {
  if (!status && !phoneFilter) return null;
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "";
  const phoneRow = phones.find((p) => String(p.id) === phoneFilter);
  const phoneLabel = phoneRow ? (phoneRow.label ?? phoneRow.displayPhoneNumber) : "";
  return (
    <div className="border-default-200 border-b bg-content2 px-3 py-2">
      <TagGroup
        aria-label="Filtros activos"
        size="sm"
        onRemove={(keys) => {
          for (const k of keys as Set<string>) {
            if (k === "status") onStatusClear();
            if (k === "phone") onPhoneClear();
          }
        }}
      >
        <TagGroup.List>
          {status ? (
            <Tag id="status" textValue={`Estado: ${statusLabel}`}>
              Estado: {statusLabel}
            </Tag>
          ) : null}
          {phoneFilter ? (
            <Tag id="phone" textValue={`Número: ${phoneLabel}`}>
              Número: {phoneLabel}
            </Tag>
          ) : null}
        </TagGroup.List>
      </TagGroup>
    </div>
  );
}

function KeyboardHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ["j"], label: "Siguiente conversación" },
    { keys: ["k"], label: "Conversación anterior" },
    { keys: ["/"], label: "Buscar" },
    { keys: ["Esc"], label: "Cerrar conversación o ayuda" },
    { keys: ["?"], label: "Mostrar / ocultar atajos" },
  ];
  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onClose()}>
      <Modal.Backdrop />
      <Modal.Container placement="center">
        <Modal.Dialog className="w-full max-w-md rounded-2xl bg-background p-5 shadow-2xl">
          <Modal.Header className="mb-3">
            <Modal.Heading className="font-semibold text-base">Atajos de teclado</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="space-y-2">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-default-700">{r.label}</span>
                <span className="flex gap-1">
                  {r.keys.map((k) => (
                    <Kbd key={k}>
                      <Kbd.Content>{k}</Kbd.Content>
                    </Kbd>
                  ))}
                </span>
              </div>
            ))}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}

function ConversationStatusChip({ status }: { status: WaConversationStatus }) {
  const map: Record<
    WaConversationStatus,
    { color: "success" | "warning" | "danger" | "default"; label: string }
  > = {
    OPEN: { color: "success", label: "Abierto" },
    PENDING: { color: "warning", label: "Pendiente" },
    CLOSED: { color: "default", label: "Cerrado" },
    ARCHIVED: { color: "default", label: "Archivado" },
  };
  const cfg = map[status] ?? { color: "default" as const, label: status };
  return (
    <Chip size="sm" color={cfg.color} variant="soft" className="shrink-0">
      <Chip.Label>{cfg.label}</Chip.Label>
    </Chip>
  );
}

function FilterDropdown({
  status,
  onStatusChange,
  phoneFilter,
  onPhoneChange,
  phones,
  activeCount,
}: {
  status: WaConversationStatus | "";
  onStatusChange: (s: WaConversationStatus | "") => void;
  phoneFilter: string;
  onPhoneChange: (v: string) => void;
  phones: { id: number; label: string | null; displayPhoneNumber: string }[];
  activeCount: number;
}) {
  return (
    <Dropdown>
      <Dropdown.Trigger>
        <Button variant="tertiary" size="sm" aria-label="Filtros">
          <Filter size={14} />
          Filtros
          {activeCount > 0 ? (
            <Chip size="sm" color="success" variant="soft" className="ml-1">
              <Chip.Label>{activeCount}</Chip.Label>
            </Chip>
          ) : null}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Popover className="w-72 space-y-3 p-3">
        <Select value={status} onChange={(k) => onStatusChange((k as WaConversationStatus) ?? "")}>
          <Label>Estado</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {STATUS_OPTIONS.map((o) => (
                <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                  {o.label}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Select value={phoneFilter} onChange={(k) => onPhoneChange((k as string) ?? "")}>
          <Label className="flex items-center gap-1">
            <Phone size={12} /> Número receptor
          </Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="" textValue="Todos los números">
                Todos los números
              </ListBox.Item>
              {phones.map((p) => (
                <ListBox.Item
                  key={p.id}
                  id={String(p.id)}
                  textValue={`${p.label ?? p.displayPhoneNumber}`}
                >
                  {p.label ?? p.displayPhoneNumber}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {/* Hidden Input keeps form-related styles consistent */}
        <Input variant="secondary" className="hidden" />
      </Dropdown.Popover>
    </Dropdown>
  );
}
