// Filtro de perfil: decide qué ofertas merecen alerta. Los valores
// (keywords/departamentos) los provee el caller (config desde DB). Si ambos
// están vacíos → matchea todo (notifica cualquier oferta nueva).

import type { RawJob } from "./types.ts";

export const DEFAULT_KEYWORDS = [
  "riesgo",
  "data",
  "datos",
  "product owner",
  "analista",
  "cumplimiento",
  "plaft",
];

export interface ProfileFilter {
  keywords: string[];
  departments: string[];
}

export function matchesProfile(job: RawJob, filter: ProfileFilter): boolean {
  // Sin ninguna restricción → todo matchea.
  if (filter.keywords.length === 0 && filter.departments.length === 0) return true;

  const dept = (job.department ?? "").toLowerCase();
  if (filter.departments.length > 0 && filter.departments.includes(dept)) return true;

  if (filter.keywords.length > 0) {
    const haystack = `${job.title} ${job.department ?? ""} ${job.location ?? ""}`.toLowerCase();
    if (filter.keywords.some((kw) => haystack.includes(kw))) return true;
  }

  return false;
}
