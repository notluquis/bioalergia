import { Input, Label, Spinner, TextField, ScrollShadow, Button, Popover } from "@heroui/react";
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

  return (
    <div className="relative space-y-2">
      <div ref={triggerRef} className="w-full">
        <TextField className="w-full" onChange={onQueryChange} value={query}>
          <Label>Buscar diagnóstico CIE-11</Label>
          <Input placeholder="Ej: rinitis, urticaria, asma alérgica…" />
        </TextField>
      </div>

      <Popover isOpen={showPanel}>
        <Popover.Content
          className="w-[var(--trigger-width)] p-0"
          placement="bottom start"
          triggerRef={triggerRef}
          offset={4}
        >
          <Popover.Dialog className="p-0 rounded-lg overflow-hidden border border-default-200 bg-content1 shadow-md">
            {loading ? (
              <div className="flex items-center gap-2 text-default-500 text-sm p-3">
                <Spinner size="sm" />
                Buscando en CIE-11…
              </div>
            ) : results.length === 0 ? (
              <div className="text-default-500 text-sm p-3">Sin resultados CIE-11</div>
            ) : (
              <ScrollShadow className="max-h-80 w-full overflow-y-auto">
                <div className="flex flex-col w-full">
                  {results.map((result, index) => {
                    const cie10 = result.code ? cie10Equivalent(result.code) : undefined;
                    const expanded = expandedId === result.id;
                    return (
                      <div key={result.id} className="flex flex-col w-full">
                        {index > 0 && <hr className="border-default-100" />}
                        <div className="flex items-stretch w-full">
                          <Button
                            className="h-auto flex-1 justify-start gap-2 bg-transparent p-3 rounded-none data-[hover=true]:bg-default-100"
                            onPress={() => pick(result)}
                          >
                            <Search className="mt-0.5 size-3.5 shrink-0 text-default-400" />
                            {result.code ? (
                              <span className="mt-0.5 shrink-0 font-mono font-semibold text-primary text-xs">
                                {result.code}
                              </span>
                            ) : null}
                            <div className="flex min-w-0 flex-1 flex-col items-start text-left">
                              <span className="block w-full truncate text-sm font-normal text-foreground">
                                {result.title}
                              </span>
                              {result.matchedTerm ? (
                                <span className="block w-full truncate text-default-400 text-xs font-normal">
                                  coincide: {result.matchedTerm}
                                </span>
                              ) : null}
                            </div>
                            {cie10 ? (
                              <span className="mt-0.5 shrink-0 text-default-400 text-xs font-normal">
                                ≈CIE-10 {cie10}
                              </span>
                            ) : null}
                          </Button>
                          <div className="w-[1px] bg-default-100 my-2" />
                          <Button
                            isIconOnly
                            className="h-auto w-12 shrink-0 bg-transparent rounded-none text-default-400 data-[hover=true]:bg-default-100 data-[hover=true]:text-primary"
                            onPress={() => setExpandedId(expanded ? null : result.id)}
                            aria-label={`Detalles de ${result.title}`}
                            aria-expanded={expanded}
                          >
                            {expanded ? <ChevronDown size={14} /> : <Info size={14} />}
                          </Button>
                        </div>
                        {expanded ? (
                          <div className="flex flex-col w-full">
                            <hr className="border-default-100" />
                            <div className="bg-default-50 px-3 py-2">
                              <Icd11DetailPanel uri={result.id} />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </ScrollShadow>
            )}
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  );
}
