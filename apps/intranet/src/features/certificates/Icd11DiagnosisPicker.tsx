import { useEffect, useRef } from "react";

import type { PrescriptionDiagnosis } from "./diagnosis-catalog";
import { cie10Equivalent, loadIcd11To10 } from "./icd-crosswalk";

// ECT (Embedded Classification Tool) de la OMS — buscador CIE-11 en español
// servido por el cloud API. Se carga desde el CDN oficial WHO (no por npm: el
// paquete es un bundle webpack-UMD que Rollup interopera mal → crash en runtime
// "undefined is not an object"). El CDN es el método que WHO documenta para React.
//
// El widget gestiona su propio DOM (input + dropdown con clases `ctw-*`), por
// eso usa elementos nativos en vez de HeroUI.

const ECT_VERSION = "1.8";
const ECT_JS = `https://icdcdn.who.int/embeddedct/icd11ect-${ECT_VERSION}.js`;
const ECT_CSS = `https://icdcdn.who.int/embeddedct/icd11ect-${ECT_VERSION}.css`;

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

declare global {
  interface Window {
    ECT?: { Handler: EctHandler };
  }
}

// Carga el script + CSS del CDN una sola vez; resuelve el Handler global.
let handlerPromise: Promise<EctHandler> | null = null;
function loadEct(): Promise<EctHandler> {
  if (handlerPromise) return handlerPromise;
  handlerPromise = new Promise<EctHandler>((resolve, reject) => {
    if (window.ECT?.Handler) {
      resolve(window.ECT.Handler);
      return;
    }
    if (!document.querySelector(`link[data-ect="${ECT_VERSION}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = ECT_CSS;
      link.dataset.ect = ECT_VERSION;
      document.head.appendChild(link);
    }
    const script = document.createElement("script");
    script.src = ECT_JS;
    script.async = true;
    script.onload = () => {
      if (window.ECT?.Handler) resolve(window.ECT.Handler);
      else reject(new Error("ECT cargó pero window.ECT.Handler no existe"));
    };
    script.onerror = () => reject(new Error("No se pudo cargar el ECT desde el CDN WHO"));
    document.body.appendChild(script);
  });
  return handlerPromise;
}

// Selección enrutada por `iNo` a la instancia correcta. Handler.configure es un
// singleton global: se configura una sola vez tras la carga.
const selectHandlers = new Map<string, (entity: EctSelectedEntity) => void>();
let instanceCounter = 0;
let configured = false;
let activeHandler: EctHandler | null = null;
let activeIno: string | null = null;

/** Inyecta una consulta en el buscador ECT activo (atajos de frecuentes). */
export function triggerIcd11Search(query: string): boolean {
  if (!activeHandler || !activeIno) return false;
  activeHandler.search(activeIno, query);
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

function ensureConfigured(handler: EctHandler): void {
  if (configured) return;
  configured = true;
  handler.configure(
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
    let cancelled = false;
    // Pre-carga el crosswalk para anexar el equivalente CIE-10 a la selección.
    void loadIcd11To10();
    void loadEct()
      .then((handler) => {
        if (cancelled) return;
        ensureConfigured(handler);
        selectHandlers.set(iNo, (entity) => {
          const diagnosis = toDiagnosis(entity);
          if (diagnosis) onSelectRef.current(diagnosis);
          handler.clear(iNo);
        });
        handler.bind(iNo);
        activeHandler = handler;
        activeIno = iNo;
      })
      .catch(() => {
        // Carga del CDN falló — el buscador queda inerte; el dr puede usar
        // "Diagnóstico escrito" como fallback.
      });
    return () => {
      cancelled = true;
      selectHandlers.delete(iNo);
      activeHandler?.clear(iNo);
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
