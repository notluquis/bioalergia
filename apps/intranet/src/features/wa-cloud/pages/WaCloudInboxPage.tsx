import {
  Avatar,
  Badge,
  Card,
  Chip,
  Dropdown,
  EmptyState,
  Input,
  Label,
  ListBox,
  SearchField,
  Select,
  Spinner,
} from "@heroui/react";
import dayjs from "dayjs";
import { Filter, Inbox, MessageSquareText, Phone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WaConversationStatus } from "@finanzas/orpc-contracts/wa-cloud";
import { ConversationDetail } from "../components/ConversationDetail";
import {
  useAccounts,
  useConversations,
  useMarkRead,
  useSearchMessages,
} from "../hooks/useWaCloud";

const STATUS_OPTIONS: { value: "" | WaConversationStatus; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "ARCHIVED", label: "Archivados" },
];

// Stable color per phone number — hash to one of HeroUI semantic colors
const AVATAR_COLORS = [
  "bg-success-200 text-success-900",
  "bg-warning-200 text-warning-900",
  "bg-accent-200 text-accent-900",
  "bg-danger-200 text-danger-900",
  "bg-default-300 text-default-900",
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

  const conversations = useConversations({
    status: status || undefined,
    phoneNumberId: phoneFilter ? Number.parseInt(phoneFilter, 10) : undefined,
    search: search.trim() || undefined,
    page: 1,
    pageSize: 50,
  });
  const markRead = useMarkRead();
  const messageHits = useSearchMessages(
    search.trim().length >= 2 ? { q: search.trim(), limit: 20 } : null,
  );

  useEffect(() => {
    if (selectedId) markRead.mutate(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const items = conversations.data?.items ?? [];
  const activeFiltersCount = (status ? 1 : 0) + (phoneFilter ? 1 : 0);

  return (
    <div className="h-[calc(100vh-7rem)] p-4">
      <Card className="grid h-full grid-cols-1 overflow-hidden p-0 lg:grid-cols-[360px_1fr]">
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

          <div className="flex-1 overflow-y-auto">
            {conversations.isLoading || !conversations.data ? (
              <div className="flex h-32 items-center justify-center">
                <Spinner />
              </div>
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
              <ul className="divide-y divide-default-200">
                {items.map((c) => {
                  const sel = selectedId === c.id;
                  const name = c.contact.name ?? c.contact.pushName ?? c.contact.phoneE164;
                  const initials = initialsOf(name);
                  const avatarColor = colorFor(c.contact.phoneE164);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-default-100 ${sel ? "bg-default-100" : ""}`}
                        onClick={() => setSelectedId(c.id)}
                      >
                        {c.unreadCount > 0 ? (
                          <Badge color="success" placement="top-right" size="sm">
                            <Badge.Label>{c.unreadCount}</Badge.Label>
                            <Badge.Anchor>
                              <Avatar className={`size-11 shrink-0 ${avatarColor}`}>
                                <Avatar.Fallback className="font-semibold text-sm">
                                  {initials}
                                </Avatar.Fallback>
                              </Avatar>
                            </Badge.Anchor>
                          </Badge>
                        ) : (
                          <Avatar className={`size-11 shrink-0 ${avatarColor}`}>
                            <Avatar.Fallback className="font-semibold text-sm">
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
                      </button>
                    </li>
                  );
                })}
              </ul>
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
                          <span className="shrink-0 text-default-400 text-[10px]">
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
          </div>
        </aside>

        <section className="flex h-full flex-col overflow-hidden bg-content1">
          {selectedId ? (
            <ConversationDetail conversationId={selectedId} />
          ) : (
            <div className="flex h-full flex-1 items-center justify-center bg-default-50 p-8">
              <EmptyState className="max-w-sm text-center">
                <MessageSquareText size={48} className="mx-auto text-default-300" />
                <p className="mt-3 font-semibold text-base">Selecciona una conversación</p>
                <p className="mt-1 text-default-500 text-sm">
                  Tus mensajes WhatsApp aparecen en la bandeja de la izquierda. Click en cualquiera
                  para responder.
                </p>
              </EmptyState>
            </div>
          )}
        </section>
      </Card>
    </div>
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
        <button
          type="button"
          className="relative inline-flex items-center gap-1 rounded-md border border-default-200 bg-default-100 px-2.5 py-1 text-default-700 text-xs hover:bg-default-200"
          aria-label="Filtros"
        >
          <Filter size={14} />
          Filtros
          {activeCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-success px-1 font-semibold text-[10px] text-success-foreground">
              {activeCount}
            </span>
          )}
        </button>
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
