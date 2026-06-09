// Búsqueda CIE-11 contra la API oficial WHO (id.who.int) — el ranking/NLP lo
// hace el servidor WHO; acá solo pedimos y normalizamos. Reemplaza al widget
// ECT (su UI chocaba con HeroUI). El token sale de nuestro proxy authed
// /api/icd11/token (client_secret server-side); lo cacheamos en memoria ~50min
// para no pegarle al proxy en cada tecla.

const RELEASE = "2026-01";
const SEARCH_URL = `https://id.who.int/icd/release/11/${RELEASE}/mms/search`;

export type Icd11SearchResult = {
  /** Linearization URI estable (id == foundation/linearization). */
  id: string;
  /** Código CIE-11 (MMS), p.ej. "CA08.0". Vacío en entidades agrupadoras. */
  code: string;
  /** Título en español, sin markup. */
  title: string;
  /** Sinónimo/término que disparó el match (si difiere del título). */
  matchedTerm?: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.token;
  const response = await fetch("/api/icd11/token", { credentials: "include" });
  if (!response.ok) throw new Error(`ICD-11 token request failed: ${response.status}`);
  const data = (await response.json()) as { token: string };
  // El token WHO dura ~1h; cacheamos 50min para tener margen.
  tokenCache = { token: data.token, expiresAt: Date.now() + 50 * 60 * 1000 };
  return data.token;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type RawMatchingPV = { label?: string; propertyId?: string };
type RawEntity = {
  id?: string;
  // En los resultados de búsqueda el código viene en `theCode` (NO `code`).
  theCode?: string;
  code?: string;
  title?: string;
  matchingPVs?: RawMatchingPV[];
};

// Sinónimo/título-de-otra-entidad que disparó el match, si difiere del título.
function pickMatchedTerm(entity: RawEntity, title: string): string | undefined {
  const pv = entity.matchingPVs?.find((p) => {
    const label = stripHtml(p.label ?? "");
    return (
      label &&
      label.toLowerCase() !== title.toLowerCase() &&
      (p.propertyId === "Synonym" || p.propertyId === "TitleOfOtherEntity")
    );
  });
  return pv ? stripHtml(pv.label ?? "") : undefined;
}

export async function searchIcd11(
  query: string,
  signal?: AbortSignal
): Promise<Icd11SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const token = await getToken();
  const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&useFlexisearch=true&flatResults=true&highlightingEnabled=false`;
  const response = await fetch(url, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
      "API-Version": "v2",
      Accept: "application/json",
      "Accept-Language": "es",
    },
  });
  if (!response.ok) throw new Error(`ICD-11 search failed: ${response.status}`);
  const data = (await response.json()) as { destinationEntities?: RawEntity[] };
  return (data.destinationEntities ?? [])
    .map((entity) => {
      const title = stripHtml(entity.title ?? "");
      return {
        id: entity.id ?? "",
        code: (entity.theCode ?? entity.code ?? "").trim(),
        matchedTerm: pickMatchedTerm(entity, title),
        title,
      };
    })
    .filter((entity) => entity.id && entity.title);
}
