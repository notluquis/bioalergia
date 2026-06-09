import { ECT as ectRuntime } from "@whoicd/icd11ect";
import "@whoicd/icd11ect/style.css";
import { useEffect, useRef } from "react";

import type { PrescriptionDiagnosis } from "./diagnosis-catalog";
import { cie10Equivalent, loadIcd11To10 } from "./icd-crosswalk";

// ECT (Embedded Classification Tool) de la OMS — buscador CIE-11 en español
// servido por el cloud API. El widget gestiona su propio DOM (input + dropdown
// con clases `ctw-*`), por eso usa elementos nativos en vez de HeroUI.
//
// El paquete `@whoicd/icd11ect` no trae tipos, así que declaramos solo la
// superficie que usamos y casteamos el runtime una vez (evita `any`).

type EctSelectedEntity = {
  iNo: string;
  code: string;
  title: string;
  selectedText: string;
  foundationUri: string;
  linearizationUri: string;
  searchQuery: string;
};

type EctSettings = {
  apiServerUrl: string;
  apiSecured?: boolean;
  language?: string;
  sourceApp?: string;
  autoBind?: boolean;
};

type EctCallbacks = {
  selectedEntityFunction?: (entity: EctSelectedEntity) => void;
  getNewTokenFunction?: () => Promise<string>;
};

type EctHandler = {
  configure: (settings: EctSettings, callbacks: EctCallbacks) => void;
  bind: (iNo: string) => void;
  clear: (iNo: string) => void;
  search: (iNo: string, query: string) => void;
};

const Handler = (ectRuntime as { Handler: EctHandler }).Handler;

// Handler.configure es un singleton global: se configura una sola vez y enruta
// la selección por `iNo` a la instancia correcta vía `selectHandlers`.
const selectHandlers = new Map<string, (entity: EctSelectedEntity) => void>();
let instanceCounter = 0;
let configured = false;
// iNo de la instancia ECT montada actualmente — usado por los atajos de
// "frecuentes" para inyectar una búsqueda en el buscador oficial.
let activeIno: string | null = null;

/** Inyecta una consulta en el buscador ECT activo (atajos de frecuentes). */
export function triggerIcd11Search(query: string): boolean {
  if (!activeIno) return false;
  Handler.search(activeIno, query);
  return true;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchIcdToken(): Promise<string> {
  const response = await fetch("/api/icd11/token", { credentials: "include" });
  if (!response.ok) throw new Error(`ICD-11 token request failed: ${response.status}`);
  const data = (await response.json()) as { token: string };
  return data.token;
}

function ensureConfigured(): void {
  if (configured) return;
  configured = true;
  Handler.configure(
    {
      apiServerUrl: "https://id.who.int",
      apiSecured: true,
      autoBind: false,
      language: "es",
      sourceApp: "Bioalergia",
    },
    {
      getNewTokenFunction: fetchIcdToken,
      selectedEntityFunction: (entity) => {
        selectHandlers.get(entity.iNo)?.(entity);
      },
    }
  );
}

function toDiagnosis(entity: EctSelectedEntity): PrescriptionDiagnosis | null {
  const label = stripHtml(entity.title || entity.selectedText);
  if (!label) return null;
  return {
    cie10Code: entity.code ? cie10Equivalent(entity.code) : undefined,
    code: entity.code || undefined,
    id: entity.foundationUri || entity.code || label,
    label,
    source: "CIE-11",
    sourceLabel: "CIE-11 OMS",
    uri: entity.foundationUri || undefined,
  };
}

export function Icd11DiagnosisPicker({
  onSelect,
}: {
  onSelect: (diagnosis: PrescriptionDiagnosis) => void;
}) {
  const inoRef = useRef<string>("");
  if (!inoRef.current) inoRef.current = String(++instanceCounter);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const iNo = inoRef.current;
    ensureConfigured();
    // Pre-carga el crosswalk para anexar el equivalente CIE-10 a la selección.
    void loadIcd11To10();
    selectHandlers.set(iNo, (entity) => {
      const diagnosis = toDiagnosis(entity);
      if (diagnosis) onSelectRef.current(diagnosis);
      Handler.clear(iNo);
    });
    Handler.bind(iNo);
    activeIno = iNo;
    return () => {
      selectHandlers.delete(iNo);
      Handler.clear(iNo);
      if (activeIno === iNo) activeIno = null;
    };
  }, []);

  return (
    <div className="space-y-2">
      <input
        autoComplete="off"
        className="ctw-input w-full rounded-lg border border-default-200 bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        data-ctw-ino={inoRef.current}
        placeholder="Buscar diagnóstico CIE-11 (ej: rinitis, urticaria, asma)…"
        type="text"
      />
      <div className="ctw-window" data-ctw-ino={inoRef.current} />
    </div>
  );
}
