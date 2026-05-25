// Buscador con autocomplete debounced sobre catalog.list. Backed por
// pg_trgm GIN indexes en products(name, brand, sku) — latencia <50ms.
//
// Render: SearchField HeroUI v3 + popover con top 6 matches.

import { Input, Label, SearchField } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CLP_FORMATTER } from "@/features/shop/lib/shop-config";
import { catalogClient } from "@/lib/orpc-client";

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBar({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const debounced = useDebounced(q.trim(), 250);

  const { data, isFetching } = useQuery({
    enabled: debounced.length >= 2,
    queryKey: ["shop", "search", debounced],
    queryFn: () => catalogClient.list({ q: debounced, limit: 6 }),
    staleTime: 1000 * 60,
  });

  const results = data?.data ?? [];
  const showPopover = focused && debounced.length >= 2;

  return (
    <div className={`relative ${className}`}>
      <SearchField
        aria-label="Buscar productos"
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onChange={setQ}
        onFocus={() => setFocused(true)}
        value={q}
      >
        <Label className="sr-only">Buscar</Label>
        <Input placeholder="Buscar productos…" />
      </SearchField>

      {showPopover && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-xl border border-foreground/10 bg-surface shadow-lg">
          {isFetching && results.length === 0 ? (
            <p className="px-3 py-2 text-foreground/60 text-sm">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-foreground/60 text-sm">Sin resultados</p>
          ) : (
            <ul>
              {results.map((p) => {
                const img = p.images?.find((i) => i.is_primary) ?? p.images?.[0];
                return (
                  <li key={p.id}>
                    <button
                      className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-foreground/5"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setQ("");
                        setFocused(false);
                        void navigate({ to: "/producto/$slug", params: { slug: p.slug } });
                      }}
                      type="button"
                    >
                      {img && (
                        <img
                          alt=""
                          className="flex-shrink-0 rounded-md object-cover size-10"
                          src={img.cdn_url}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-sm">{p.name}</span>
                        <span className="block text-foreground/60 text-xs">
                          {p.brand ?? "—"} · SKU {p.sku}
                        </span>
                      </span>
                      <span className="flex-shrink-0 font-bold text-sm">
                        {CLP_FORMATTER.format(p.price_clp)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
