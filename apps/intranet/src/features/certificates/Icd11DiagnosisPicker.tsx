import { Collection, ComboBox, Input, Label, ListBox, Spinner } from "@heroui/react";
import type { Key } from "react";
import { useEffect, useState } from "react";

import type { PrescriptionDiagnosis } from "./diagnosis-catalog";
import { cie10Equivalent, loadIcd11To10 } from "./icd-crosswalk";
import { type Icd11SearchResult, searchIcd11 } from "./icd11-search";

// Buscador CIE-11 nativo HeroUI. Consulta la API oficial WHO (id.who.int) — el
// ranking/NLP es server-side — y renderiza los resultados con el look de la app.
// Controlado por `query` para que los atajos (frecuentes / código CIE-10) puedan
// disparar una búsqueda seteando el texto.

const DEBOUNCE_MS = 250;

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

  // Búsqueda con debounce + cancelación de la request anterior.
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
          setResults(items);
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

  const handleSelection = (key: Key | null) => {
    if (key == null) return;
    const hit = results.find((result) => result.id === key);
    if (!hit) return;
    onSelect(toDiagnosis(hit));
    onQueryChange("");
    setResults([]);
  };

  return (
    <ComboBox
      allowsEmptyCollection
      className="w-full"
      inputValue={query}
      items={results}
      menuTrigger="input"
      onInputChange={onQueryChange}
      onSelectionChange={handleSelection}
      selectedKey={null}
    >
      <Label>Buscar diagnóstico CIE-11</Label>
      <ComboBox.InputGroup>
        <Input placeholder="Ej: rinitis, urticaria, asma alérgica…" />
        {loading ? <Spinner size="sm" /> : <ComboBox.Trigger />}
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <div className="px-3 py-6 text-center text-default-500 text-sm">
              {query.trim().length < 2
                ? "Escribe al menos 2 letras"
                : loading
                  ? "Buscando…"
                  : "Sin resultados CIE-11"}
            </div>
          )}
        >
          <Collection items={results}>
            {(item) => (
              <ListBox.Item id={item.id} key={item.id} textValue={item.title}>
                <div className="flex w-full items-center gap-2">
                  {item.code ? (
                    <span className="shrink-0 font-mono font-semibold text-primary text-xs">
                      {item.code}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
                  {item.code && cie10Equivalent(item.code) ? (
                    <span className="shrink-0 text-default-400 text-xs">
                      ≈CIE-10 {cie10Equivalent(item.code)}
                    </span>
                  ) : null}
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </Collection>
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}
