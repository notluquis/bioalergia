import { Card, Chip, Spinner } from "@heroui/react";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import type { WaConversationStatus } from "@finanzas/orpc-contracts/wa-cloud";
import { ConversationDetail } from "../components/ConversationDetail";
import { SelectInput, TextInput } from "@/features/outreach/components/FormField";
import { useAccounts, useConversations, useMarkRead } from "../hooks/useWaCloud";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "OPEN", label: "Abiertos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "CLOSED", label: "Cerrados" },
  { value: "ARCHIVED", label: "Archivados" },
];

export function WaCloudInboxPage() {
  const accounts = useAccounts();
  const allPhones = useMemo(
    () => (accounts.data?.accounts ?? []).flatMap((a) => a.phoneNumbers),
    [accounts.data]
  );
  const phoneOptions = useMemo(
    () => [
      { value: "", label: "Todos los números" },
      ...allPhones.map((p) => ({
        value: String(p.id),
        label: `${p.label ?? p.displayPhoneNumber} (${p.displayPhoneNumber})`,
      })),
    ],
    [allPhones]
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

  useEffect(() => {
    if (selectedId) markRead.mutate(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="grid h-[calc(100vh-7rem)] grid-cols-1 gap-3 p-4 lg:grid-cols-[360px_1fr]">
      <Card className="flex flex-col overflow-hidden">
        <Card.Header className="space-y-2 p-3">
          <Card.Title>Bandeja unificada</Card.Title>
          <div className="grid grid-cols-1 gap-2">
            <TextInput
              label="Buscar"
              placeholder="Nombre o teléfono"
              value={search}
              onValueChange={setSearch}
            />
            <SelectInput
              label="Estado"
              value={status}
              onValueChange={(v) => setStatus(v as WaConversationStatus | "")}
              options={STATUS_OPTIONS}
            />
            <SelectInput
              label="Número receptor"
              value={phoneFilter}
              onValueChange={setPhoneFilter}
              options={phoneOptions}
            />
          </div>
        </Card.Header>
        <Card.Content className="flex-1 overflow-y-auto p-0">
          {conversations.isLoading || !conversations.data ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner />
            </div>
          ) : conversations.data.items.length === 0 ? (
            <p className="p-4 text-default-500 text-sm">Sin conversaciones.</p>
          ) : (
            <ul className="divide-y divide-default-200">
              {conversations.data.items.map((c) => {
                const sel = selectedId === c.id;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className={`w-full p-3 text-left hover:bg-default-100 ${sel ? "bg-default-100" : ""}`}
                      onClick={() => setSelectedId(c.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-sm">
                          {c.contact.name ?? c.contact.pushName ?? c.contact.phoneE164}
                        </span>
                        {c.unreadCount > 0 && (
                          <Chip size="sm" color="success" variant="soft">
                            {c.unreadCount}
                          </Chip>
                        )}
                      </div>
                      <p className="line-clamp-1 text-default-500 text-xs">
                        {c.lastMessagePreview ?? "—"}
                      </p>
                      <div className="mt-1 flex items-center justify-between gap-2 text-default-400 text-xs">
                        <span>
                          {c.lastMessageAt
                            ? dayjs(c.lastMessageAt).format("DD-MM HH:mm")
                            : "sin actividad"}
                        </span>
                        <Chip size="sm" variant="soft">
                          {c.status}
                        </Chip>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card.Content>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        {selectedId ? (
          <ConversationDetail conversationId={selectedId} />
        ) : (
          <Card.Content className="flex h-full items-center justify-center text-default-500 text-sm">
            <span>Selecciona una conversación</span>
          </Card.Content>
        )}
      </Card>
    </div>
  );
}
