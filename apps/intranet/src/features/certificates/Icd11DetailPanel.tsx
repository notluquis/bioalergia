import { Spinner } from "@heroui/react";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { fetchIcd11Detail, type Icd11Detail } from "./icd11-search";

// Panel de detalle de un entity CIE-11 (definición, sinónimos, exclusiones, link
// WHO). Auto-fetch on mount por `uri` (cacheado en icd11-search). Compartido por
// el buscador (expand ⓘ) y el chip de diagnóstico seleccionado (popover).

type State = Icd11Detail | "loading" | "error";

export function Icd11DetailPanel({ uri }: { uri: string }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetchIcd11Detail(uri)
      .then((detail) => {
        if (!cancelled) setState(detail);
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  if (state === "loading") {
    return (
      <span className="flex items-center gap-2 text-default-500 text-xs">
        <Spinner size="sm" /> Cargando definición…
      </span>
    );
  }
  if (state === "error") {
    return <span className="text-default-500 text-xs">No se pudo cargar el detalle.</span>;
  }

  return (
    <div className="space-y-1 text-default-600 text-xs">
      {state.definition ? <p>{state.definition}</p> : <p>Sin definición oficial.</p>}
      {state.synonyms.length > 0 ? (
        <p>
          <span className="font-semibold">Sinónimos: </span>
          {state.synonyms.slice(0, 6).join(", ")}
        </p>
      ) : null}
      {state.exclusions.length > 0 ? (
        <p>
          <span className="font-semibold">No incluye: </span>
          {state.exclusions.slice(0, 6).join("; ")}
        </p>
      ) : null}
      {state.browserUrl ? (
        <a
          className="inline-flex items-center gap-1 text-primary hover:underline"
          href={state.browserUrl}
          rel="noreferrer"
          target="_blank"
        >
          Ver en navegador WHO <ExternalLink size={11} />
        </a>
      ) : null}
    </div>
  );
}
