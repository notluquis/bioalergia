// Filtro de perfil: decide qué ofertas merecen alerta. Configurable por env
// (ver [feedback_minimize_hardcoded] — no hardcodear listas). Si NO hay config,
// matchea todo (notifica cualquier oferta nueva).
//
//   JOB_RADAR_KEYWORDS     CSV; matchea contra title + department + location.
//   JOB_RADAR_DEPARTMENTS  CSV; matchea contra department (exacto, case-insensitive).

import type { RawJob } from "./types.ts";

const DEFAULT_KEYWORDS = [
  "riesgo",
  "data",
  "datos",
  "product owner",
  "analista",
  "cumplimiento",
  "plaft",
];

function parseCsvEnv(value: string | undefined, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  const items = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0);
  return items; // "" explícito → [] → matchea todo en esa dimensión
}

export interface ProfileFilter {
  keywords: string[];
  departments: string[];
}

export function getProfileFilter(): ProfileFilter {
  return {
    keywords: parseCsvEnv(process.env.JOB_RADAR_KEYWORDS, DEFAULT_KEYWORDS),
    departments: parseCsvEnv(process.env.JOB_RADAR_DEPARTMENTS, []),
  };
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
