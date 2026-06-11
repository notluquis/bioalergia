import { Input, Label, Spinner, TextField, Popover } from "@heroui/react";
import { ChevronDown, Info, Search } from "lucide-react";
import { useEffect, useState, useRef } from "react";

import type { PrescriptionDiagnosis } from "./diagnosis-catalog";
import { cie10Equivalent, loadIcd11To10 } from "./icd-crosswalk";
import { Icd11DetailPanel } from "./Icd11DetailPanel";
import { type Icd11SearchResult, searchIcd11 } from "./icd11-search";

// Buscador CIE-11 nativo HeroUI. Consulta la API oficial WHO (id.who.int) — el
// ranking/NLP es server-side — y muestra los resultados INLINE (no en popover).
// Cada resultado se expande (ⓘ) para ver definición/exclusiones/link WHO.
// Controlado por `query`.

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 15;

function toDiagnosis(result: Icd11SearchResult): PrescriptionDiagnosis {
  return {
    cie10Code: result.code ? cie10Equivalent(result.code) : undefined,
    code: result.code || undefined,
    id: result.id,
    label: result.title,
    source: "CIE-11",
    sourceLabel: "CIE-11 OMS",
    uri: result.id,
  };
}

export function Icd11DiagnosisPicker({
  query,
  onQueryChange,
  onSelect,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSelect: (diagnosis: PrescriptionDiagnosis) => void;
}) {
  const [results, setResults] = useState<Icd11SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void loadIcd11To10();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchIcd11(q, controller.signal)
        .then((items) => {
          setResults(items.slice(0, MAX_RESULTS));
          setExpandedId(null);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setResults([]);
          setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const pick = (result: Icd11SearchResult) => {
    onSelect(toDiagnosis(result));
    onQueryChange("");
    setResults([]);
  };

  const showPanel = query.trim().length >= 2;
  const triggerRef = useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>();

  useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [showPanel]);

  return (
    <div className="space-y-2">
      <Popover isOpen={showPanel}>
        <Popover.Trigger>
          <div ref={triggerRef} className="w-full cursor-text">
            <TextField onChange={onQueryChange} value={query}>
              <Label>Buscar diagnóstico CIE-11</Label>
              <Input placeholder="Ej: rinitis, urticaria, asma alérgica…" />
            </TextField>
          </div>
        </Popover.Trigger>

        {showPanel ? (
          <Popover.Content
            isNonModal
            placement="bottom"
            offset={4}
            className="max-h-80 overflow-y-auto p-0 border border-default-200 items-start justify-start"
            style={{ width: triggerWidth ? `${triggerWidth}px` : "auto" }}
          >
            <div className="w-full p-0 outline-none">
              {loading ? (
                <div className="flex items-center gap-2 text-default-500 text-sm p-3">
                  <Spinner size="sm" />
                  Buscando en CIE-11…
                </div>
              ) : results.length === 0 ? (
                <div className="text-default-500 text-sm p-3">Sin resultados CIE-11</div>
              ) : (
                <ul className="max-h-80 divide-y divide-default-100 overflow-y-auto">
                  {results.map((result) => {
                    const cie10 = result.code ? cie10Equivalent(result.code) : undefined;
                    const expanded = expandedId === result.id;
                    return (
                      <li key={result.id}>
                        <div className="flex items-stretch">
                          <button
                            className="flex min-w-0 flex-1 items-start gap-2 px-3 py-2 text-left transition hover:bg-default-100"
                            onClick={() => pick(result)}
                            type="button"
                          >
                            <Search className="mt-0.5 size-3.5 shrink-0 text-default-400" />
                            {result.code ? (
                              <span className="mt-0.5 shrink-0 font-mono font-semibold text-primary text-xs">
                                {result.code}
                              </span>
                            ) : null}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{result.title}</span>
                              {result.matchedTerm ? (
                                <span className="block truncate text-default-400 text-xs">
                                  coincide: {result.matchedTerm}
                                </span>
                              ) : null}
                            </span>
                            {cie10 ? (
                              <span className="mt-0.5 shrink-0 text-default-400 text-xs">
                                ≈CIE-10 {cie10}
                              </span>
                            ) : null}
                          </button>
                          <button
                            aria-expanded={expanded}
                            aria-label={`Detalles de ${result.title}`}
                            className="flex shrink-0 items-center border-default-100 border-l px-2 text-default-400 transition hover:bg-default-100 hover:text-primary"
                            onClick={() => setExpandedId(expanded ? null : result.id)}
                            type="button"
                          >
                            {expanded ? <ChevronDown size={14} /> : <Info size={14} />}
                          </button>
                        </div>
                        {expanded ? (
                          <div className="bg-default-50 px-3 py-2">
                            <Icd11DetailPanel uri={result.id} />
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Popover.Content>
        ) : null}
      </Popover>
    </div>
  );
}
