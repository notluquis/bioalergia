import { Input, Label, Spinner, TextField } from "@heroui/react";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import type { PrescriptionDiagnosis } from "./diagnosis-catalog";
import { cie10Equivalent, loadIcd11To10 } from "./icd-crosswalk";
import { type Icd11SearchResult, searchIcd11 } from "./icd11-search";

// Buscador CIE-11 nativo HeroUI. Consulta la API oficial WHO (id.who.int) — el
// ranking/NLP es server-side — y muestra los resultados INLINE (no en popover):
// así un atajo (frecuente / código CIE-10) que setea el texto deja ver el
// "Buscando…" y la lista sin que el usuario tenga que abrir nada.
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

  return (
    <div className="space-y-2">
      <TextField onChange={onQueryChange} value={query}>
        <Label>Buscar diagnóstico CIE-11</Label>
        <Input placeholder="Ej: rinitis, urticaria, asma alérgica…" />
      </TextField>

      {showPanel ? (
        <div className="overflow-hidden rounded-lg border border-default-200">
          {loading ? (
            <div className="flex items-center gap-2 text-default-500 text-sm p-3">
              <Spinner size="sm" />
              Buscando en CIE-11…
            </div>
          ) : results.length === 0 ? (
            <div className="text-default-500 text-sm p-3">Sin resultados CIE-11</div>
          ) : (
            <ul className="max-h-72 divide-y divide-default-100 overflow-y-auto">
              {results.map((result) => {
                const cie10 = result.code ? cie10Equivalent(result.code) : undefined;
                return (
                  <li key={result.id}>
                    <button
                      className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-default-100"
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
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
