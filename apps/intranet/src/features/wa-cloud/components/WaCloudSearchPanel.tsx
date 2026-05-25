// oxlint-disable typescript/no-non-null-assertion -- TODO(strict-null)
import { Card, Chip, EmptyState, Kbd, ScrollShadow, SearchField } from "@heroui/react";
import dayjs from "dayjs";
import { MessageSquareText, Phone, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { WaListSkeleton } from "./Skeletons";
import { useAccounts, useSearchMessages } from "../hooks/useWaCloud";

/**
 * Shared global-search UI for wa-cloud messages.
 *
 * Used by both the legacy standalone `/wa-cloud/buscar` page (redirect
 * shell during the migration window) and the new `InboxSearchDrawer`
 * inside the unified `/wa-cloud` host. Extracted to keep a single
 * source of truth for the search field + result rendering so the
 * drawer body doesn't drift from the original page contract.
 *
 * Caller controls what happens on result click — typically the drawer
 * sets `?conversation=X` on the inbox route and closes itself; the
 * legacy page navigates to `/wa-cloud?conversation=X`.
 */
export interface WaCloudSearchPanelProps {
  onSelectConversation: (conversationId: number) => void;
  /** Render the explanatory header above the field (off in drawer; drawer has its own heading). */
  showHeader?: boolean;
}

export function WaCloudSearchPanel({
  onSelectConversation,
  showHeader = true,
}: WaCloudSearchPanelProps) {
  const accounts = useAccounts();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const enabled = debouncedQ.length >= 2;
  const results = useSearchMessages(enabled ? { q: debouncedQ, limit: 100 } : null);

  const allPhones = (accounts.data?.accounts ?? []).flatMap((a) => a.phoneNumbers);
  const hits = results.data?.results ?? [];

  return (
    <div className="space-y-4">
      {showHeader && (
        <header className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-xl">
            <Search size={20} className="text-success" />
            Buscar en WhatsApp
          </h2>
          <p className="text-default-500 text-sm">
            Busca mensajes en TODAS las conversaciones por contenido, nombre o teléfono. Click en un
            resultado para abrir el chat. Mínimo{" "}
            <Kbd>
              <Kbd.Content>2</Kbd.Content>
            </Kbd>{" "}
            caracteres.
          </p>
        </header>
      )}

      <Card>
        <Card.Content className="space-y-3 p-4">
          <SearchField variant="secondary" value={q} onChange={setQ} aria-label="Buscar mensajes">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input placeholder="Escribe al menos 2 caracteres…" />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>

          {allPhones.length > 1 ? (
            <p className="text-default-500 text-xs">
              <Phone size={12} className="mr-1 inline" />
              Buscás en {allPhones.length} números a la vez. Para filtrar por uno, incluí los
              últimos dígitos en el query.
            </p>
          ) : null}
        </Card.Content>
      </Card>

      {!enabled ? (
        <EmptyState className="m-4 p-8 text-center">
          <Search size={32} className="mx-auto text-default-300" />
          <p className="mt-2 font-medium text-base">Buscador global de mensajes</p>
          <p className="text-default-500 text-sm">
            Escribe el contenido de un mensaje o el nombre/teléfono del contacto. Mostramos las 100
            coincidencias más recientes.
          </p>
        </EmptyState>
      ) : results.isLoading ? (
        <Card>
          <WaListSkeleton rows={6} />
        </Card>
      ) : hits.length === 0 ? (
        <EmptyState className="m-4 p-8 text-center">
          <MessageSquareText size={32} className="mx-auto text-default-300" />
          <p className="mt-2 font-medium text-base">Sin resultados</p>
          <p className="text-default-500 text-sm">
            Prueba con menos caracteres, sin filtro de número o un término más amplio.
          </p>
        </EmptyState>
      ) : (
        <Card>
          <Card.Header className="flex items-center justify-between">
            <Card.Title>Coincidencias ({hits.length})</Card.Title>
            <Chip size="sm" variant="soft" color="default">
              <Chip.Label>top 100</Chip.Label>
            </Chip>
          </Card.Header>
          <ScrollShadow
            orientation="vertical"
            size={32}
            hideScrollBar
            className="max-h-[60dvh] overflow-y-auto"
          >
            <ul className="divide-default-200 divide-y">
              {hits.map((m) => (
                <li key={m.messageId}>
                  <button
                    type="button"
                    onClick={() => onSelectConversation(m.conversationId)}
                    className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-default-100"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-sm">{m.contactName ?? m.phoneE164}</span>
                      <span className="text-default-400 text-xs">
                        {dayjs(m.timestamp).format("DD-MM-YY HH:mm")}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-default-600 text-sm">
                      {m.body ?? `[${m.type.toLowerCase()}]`}
                    </p>
                    <div className="flex items-center gap-2 text-default-400 text-xs">
                      <Chip size="sm" variant="soft" color="default">
                        <Chip.Label>{m.type}</Chip.Label>
                      </Chip>
                      {m.phoneE164 !== m.contactName ? <span>{m.phoneE164}</span> : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollShadow>
        </Card>
      )}
    </div>
  );
}
